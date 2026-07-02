package realtime

import "encoding/json"

// EventType enumerates the WebSocket message types exchanged with clients.
type EventType string

const (
	EventPlayerJoin  EventType = "player_join"
	EventPlayerLeave EventType = "player_leave"
	EventPlayerMove  EventType = "player_move"
	EventChatMessage EventType = "chat_message"
	EventGiftDrop    EventType = "gift_drop"
	EventGiftPickup  EventType = "gift_pickup"
	// EventWorldState is the initial snapshot sent to a freshly joined client so
	// it learns about players that were already in the world.
	EventWorldState EventType = "world_state"
	// EventChatHistory delivers recent persisted messages to a joining client.
	EventChatHistory EventType = "chat_history"
	// EventGiftHistory delivers active (un-picked) gifts to a joining client.
	EventGiftHistory EventType = "gift_history"
	// EventHouseState delivers the full furniture layout to a joining client.
	EventHouseState      EventType = "house_state"
	EventFurniturePlace  EventType = "furniture_place"
	EventFurnitureRemove EventType = "furniture_remove"
	// EventHouseEnter is sent by the client when a player enters the house scene.
	EventHouseEnter EventType = "house_enter"
	// EventMemoryHistory delivers all milestones to a joining client.
	EventMemoryHistory EventType = "memory_history"
	// EventMemoryCreated is broadcast when a new first_* milestone is reached.
	EventMemoryCreated EventType = "memory_created"
)

// Envelope is the single wire format for every message in both directions.
//
//	{ "type": "...", "world_id": "...", "player_id": "...", "payload": { } }
//
// On inbound messages the server trusts world_id/player_id from the
// authenticated connection, NOT from the envelope (which clients could forge).
type Envelope struct {
	Type     EventType       `json:"type"`
	WorldID  string          `json:"world_id"`
	PlayerID string          `json:"player_id"`
	Payload  json.RawMessage `json:"payload,omitempty"`
}

// PlayerSnapshot is a serialisable view of a player's current state.
type PlayerSnapshot struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Direction string  `json:"direction"`
	Online    bool    `json:"online"`
}

// NewEnvelope marshals an outbound message ready to be broadcast.
func NewEnvelope(t EventType, worldID, playerID string, payload any) ([]byte, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return json.Marshal(Envelope{
		Type:     t,
		WorldID:  worldID,
		PlayerID: playerID,
		Payload:  raw,
	})
}
