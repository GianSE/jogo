package ws

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/gianpedrodev/casinha/backend/internal/application"
	"github.com/gianpedrodev/casinha/backend/internal/domain"
	"github.com/gianpedrodev/casinha/backend/internal/realtime"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
	sendBuffer     = 32
)

// --- inbound payload shapes ---

type movePayload struct {
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Direction string  `json:"direction"`
}

type chatPayload struct {
	Body string `json:"body"`
}

type giftDropPayload struct {
	ItemSlug string  `json:"item_slug"`
	Scene    string  `json:"scene"`
	X        int     `json:"x"`
	Y        int     `json:"y"`
	Message  *string `json:"message,omitempty"`
}

type giftPickupPayload struct {
	GiftID string `json:"gift_id"`
}

type furniturePlacePayload struct {
	ItemSlug string `json:"item_slug"`
	X        int    `json:"x"`
	Y        int    `json:"y"`
	Rotation int16  `json:"rotation"`
}

type furnitureRemovePayload struct {
	FurnitureID string `json:"furniture_id"`
}

// --- outbound wire shapes ---

type worldStatePayload struct {
	Players []realtime.PlayerSnapshot `json:"players"`
}

type chatItem struct {
	ID     int64  `json:"id"`
	Sender string `json:"sender"`
	Body   string `json:"body"`
	At     string `json:"at"`
}

type chatHistoryPayload struct {
	Messages []chatItem `json:"messages"`
}

type giftItem struct {
	ID       string  `json:"id"`
	ItemSlug string  `json:"item_slug"`
	From     string  `json:"from"`
	Scene    string  `json:"scene"`
	X        int     `json:"x"`
	Y        int     `json:"y"`
	Message  *string `json:"message,omitempty"`
	At       string  `json:"at"`
}

type giftHistoryPayload struct {
	Gifts []giftItem `json:"gifts"`
}

type giftPickupResult struct {
	GiftID   string `json:"gift_id"`
	PickedBy string `json:"picked_by"`
}

type furnitureItem struct {
	ID       string `json:"id"`
	ItemSlug string `json:"item_slug"`
	PlacedBy string `json:"placed_by"`
	X        int    `json:"x"`
	Y        int    `json:"y"`
	Rotation int16  `json:"rotation"`
	ZIndex   int    `json:"z_index"`
}

type houseStatePayload struct {
	Furniture []furnitureItem `json:"furniture"`
}

type furnitureRemoveResult struct {
	FurnitureID string `json:"furniture_id"`
	RemovedBy   string `json:"removed_by"`
}

type memoryItem struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	Description string `json:"description"`
	OccurredAt  string `json:"occurred_at"` // RFC3339
}

type memoryHistoryPayload struct {
	Memories []memoryItem `json:"memories"`
}

// Client wraps a single WebSocket connection and implements realtime.Conn so
// the World can broadcast to it without knowing about WebSockets.
type Client struct {
	playerID string // public display id = handle
	userID   string // persisted user UUID (for DB writes)
	worldID  string // persisted world UUID (also the hub key)
	world    *realtime.World
	mgr      *realtime.Manager
	chat     *application.ChatService
	gifts    *application.GiftService
	house    *application.HouseService
	memories *application.MemoryService
	conn     *websocket.Conn

	send chan []byte
	done chan struct{}
	once sync.Once
}

func newClient(
	conn *websocket.Conn,
	mgr *realtime.Manager,
	world *realtime.World,
	chat *application.ChatService,
	gifts *application.GiftService,
	house *application.HouseService,
	memories *application.MemoryService,
	playerID, userID, worldID string,
) *Client {
	return &Client{
		playerID: playerID,
		userID:   userID,
		worldID:  worldID,
		world:    world,
		mgr:      mgr,
		chat:     chat,
		gifts:    gifts,
		house:    house,
		memories: memories,
		conn:     conn,
		send:     make(chan []byte, sendBuffer),
		done:     make(chan struct{}),
	}
}

// --- realtime.Conn ---

func (c *Client) PlayerID() string { return c.playerID }

func (c *Client) Enqueue(msg []byte) {
	select {
	case c.send <- msg:
	case <-c.done:
	default:
		c.Close()
	}
}

func (c *Client) Close() {
	c.once.Do(func() {
		close(c.done)
		_ = c.conn.Close()
	})
}

// serve registers the client, runs the pumps, and cleans up on disconnect.
func (c *Client) serve() {
	snapshot, replaced := c.world.Register(c)
	if replaced != nil {
		replaced.Close()
	}

	// Send initial state to the joining client.
	if msg, err := realtime.NewEnvelope(realtime.EventWorldState, c.worldID, c.playerID, worldStatePayload{Players: snapshot}); err == nil {
		c.Enqueue(msg)
	}
	c.sendChatHistory()
	c.sendGiftState()
	c.sendHouseState()
	c.sendMemoryHistory()

	// Notify the partner this player joined.
	if self, ok := c.world.PlayerSnapshot(c.playerID); ok {
		if msg, err := realtime.NewEnvelope(realtime.EventPlayerJoin, c.worldID, c.playerID, self); err == nil {
			c.world.Broadcast(msg, c.playerID)
		}
	}

	// Fire first_login_together when both players are online simultaneously.
	if c.world.OnlineCount() == 2 {
		go c.recordMemory(domain.MemoryFirstLoginTogether, "Primeira vez online juntos! 💛")
	}

	go c.writePump()
	c.readPump()

	if wentOffline := c.world.Unregister(c); wentOffline {
		if msg, err := realtime.NewEnvelope(realtime.EventPlayerLeave, c.worldID, c.playerID,
			realtime.PlayerSnapshot{ID: c.playerID, Online: false}); err == nil {
			c.world.Broadcast(msg, c.playerID)
		}
		c.mgr.ScheduleDrop(c.worldID)
	}
}

func (c *Client) readPump() {
	defer c.Close()
	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		c.handle(data)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()
	for {
		select {
		case msg := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				c.Close()
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.Close()
				return
			}
		case <-c.done:
			return
		}
	}
}

// handle routes one inbound message. Identity/world come from the authenticated
// connection, never from the envelope, so a client cannot forge either.
func (c *Client) handle(data []byte) {
	var env realtime.Envelope
	if err := json.Unmarshal(data, &env); err != nil {
		return
	}

	switch env.Type {
	case realtime.EventPlayerMove:
		var p movePayload
		if json.Unmarshal(env.Payload, &p) != nil {
			return
		}
		snap, ok := c.world.ApplyMove(c.playerID, p.X, p.Y, p.Direction)
		if !ok {
			return
		}
		if msg, err := realtime.NewEnvelope(realtime.EventPlayerMove, c.worldID, c.playerID, snap); err == nil {
			c.world.Broadcast(msg, "")
		}

	case realtime.EventChatMessage:
		var p chatPayload
		if json.Unmarshal(env.Payload, &p) != nil {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		view, err := c.chat.Send(ctx, c.worldID, c.userID, c.playerID, p.Body)
		cancel()
		if err != nil {
			return
		}
		item := chatItem{ID: view.ID, Sender: view.Sender, Body: view.Body, At: view.CreatedAt.Format(time.RFC3339)}
		if msg, err := realtime.NewEnvelope(realtime.EventChatMessage, c.worldID, c.playerID, item); err == nil {
			c.world.Broadcast(msg, "")
		}

	case realtime.EventGiftDrop:
		var p giftDropPayload
		if json.Unmarshal(env.Payload, &p) != nil {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		view, err := c.gifts.Drop(ctx, c.worldID, c.userID, p.ItemSlug, domain.Scene(p.Scene), p.X, p.Y, p.Message)
		cancel()
		if err != nil {
			return
		}
		item := viewToWire(view)
		if msg, err := realtime.NewEnvelope(realtime.EventGiftDrop, c.worldID, c.playerID, item); err == nil {
			c.world.Broadcast(msg, "")
		}

	case realtime.EventGiftPickup:
		var p giftPickupPayload
		if json.Unmarshal(env.Payload, &p) != nil || p.GiftID == "" {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		err := c.gifts.Pickup(ctx, p.GiftID, c.userID)
		cancel()
		if err != nil {
			return
		}
		result := giftPickupResult{GiftID: p.GiftID, PickedBy: c.playerID}
		if msg, err := realtime.NewEnvelope(realtime.EventGiftPickup, c.worldID, c.playerID, result); err == nil {
			c.world.Broadcast(msg, "")
		}
		go c.recordMemory(domain.MemoryFirstGift, "Primeiro presente trocado! 🎁")

	case realtime.EventHouseEnter:
		go c.recordMemory(domain.MemoryFirstHouseEntry, "Primeira vez na casinha juntos! 🏠")

	case realtime.EventFurniturePlace:
		var p furniturePlacePayload
		if json.Unmarshal(env.Payload, &p) != nil || p.ItemSlug == "" {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		view, err := c.house.Place(ctx, c.worldID, c.userID, p.ItemSlug, p.X, p.Y, p.Rotation)
		cancel()
		if err != nil {
			return
		}
		item := furnitureViewToWire(view)
		if msg, err := realtime.NewEnvelope(realtime.EventFurniturePlace, c.worldID, c.playerID, item); err == nil {
			c.world.Broadcast(msg, "")
		}

	case realtime.EventFurnitureRemove:
		var p furnitureRemovePayload
		if json.Unmarshal(env.Payload, &p) != nil || p.FurnitureID == "" {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		err := c.house.Remove(ctx, p.FurnitureID, c.worldID)
		cancel()
		if err != nil {
			return
		}
		result := furnitureRemoveResult{FurnitureID: p.FurnitureID, RemovedBy: c.playerID}
		if msg, err := realtime.NewEnvelope(realtime.EventFurnitureRemove, c.worldID, c.playerID, result); err == nil {
			c.world.Broadcast(msg, "")
		}
	}
}

func (c *Client) sendChatHistory() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	views, err := c.chat.History(ctx, c.worldID)
	cancel()
	if err != nil {
		return
	}
	items := make([]chatItem, 0, len(views))
	for _, v := range views {
		items = append(items, chatItem{ID: v.ID, Sender: v.Sender, Body: v.Body, At: v.CreatedAt.Format(time.RFC3339)})
	}
	if msg, err := realtime.NewEnvelope(realtime.EventChatHistory, c.worldID, c.playerID, chatHistoryPayload{Messages: items}); err == nil {
		c.Enqueue(msg)
	}
}

func (c *Client) sendGiftState() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	views, err := c.gifts.ActiveGifts(ctx, c.worldID)
	cancel()
	if err != nil {
		return
	}
	items := make([]giftItem, 0, len(views))
	for _, v := range views {
		items = append(items, viewToWire(v))
	}
	if msg, err := realtime.NewEnvelope(realtime.EventGiftHistory, c.worldID, c.playerID, giftHistoryPayload{Gifts: items}); err == nil {
		c.Enqueue(msg)
	}
}

func viewToWire(v application.GiftView) giftItem {
	return giftItem{
		ID:       v.ID,
		ItemSlug: v.ItemSlug,
		From:     v.From,
		Scene:    string(v.Scene),
		X:        v.X,
		Y:        v.Y,
		Message:  v.Message,
		At:       v.CreatedAt.Format(time.RFC3339),
	}
}

func (c *Client) sendHouseState() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	views, err := c.house.Layout(ctx, c.worldID)
	cancel()
	if err != nil {
		return
	}
	items := make([]furnitureItem, 0, len(views))
	for _, v := range views {
		items = append(items, furnitureViewToWire(v))
	}
	if msg, err := realtime.NewEnvelope(realtime.EventHouseState, c.worldID, c.playerID, houseStatePayload{Furniture: items}); err == nil {
		c.Enqueue(msg)
	}
}

func furnitureViewToWire(v application.FurnitureView) furnitureItem {
	return furnitureItem{
		ID:       v.ID,
		ItemSlug: v.ItemSlug,
		PlacedBy: v.PlacedBy,
		X:        v.X,
		Y:        v.Y,
		Rotation: v.Rotation,
		ZIndex:   v.ZIndex,
	}
}

func (c *Client) sendMemoryHistory() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	views, err := c.memories.History(ctx, c.worldID)
	cancel()
	if err != nil {
		return
	}
	items := make([]memoryItem, 0, len(views))
	for _, v := range views {
		items = append(items, memoryViewToWire(v))
	}
	if msg, err := realtime.NewEnvelope(realtime.EventMemoryHistory, c.worldID, c.playerID, memoryHistoryPayload{Memories: items}); err == nil {
		c.Enqueue(msg)
	}
}

// recordMemory attempts to create a first_* milestone. If a new milestone is
// created, it broadcasts memory_created to all players in the world.
// Safe to call in a goroutine.
func (c *Client) recordMemory(kind domain.MemoryKind, description string) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	view, created, err := c.memories.Record(ctx, c.worldID, kind, description)
	if err != nil || !created {
		return
	}
	if msg, err := realtime.NewEnvelope(realtime.EventMemoryCreated, c.worldID, c.playerID, memoryViewToWire(view)); err == nil {
		c.world.Broadcast(msg, "")
	}
}

func memoryViewToWire(v application.MemoryView) memoryItem {
	return memoryItem{
		ID:          v.ID,
		Kind:        v.Kind,
		Description: v.Description,
		OccurredAt:  v.OccurredAt.Format(time.RFC3339),
	}
}
