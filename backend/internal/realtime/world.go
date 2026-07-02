package realtime

import "sync"

// World bounds in game units. The server clamps all positions to this box so a
// client can never push a player out of the playable area.
const (
	WorldWidth  = 2000.0
	WorldHeight = 2000.0
)

// Conn is the transport-facing side of a connected player. The ws package
// implements it; realtime stays free of any WebSocket library.
type Conn interface {
	PlayerID() string
	Enqueue(msg []byte)
	Close()
}

// PlayerState is the authoritative in-memory state for one player in a world.
type PlayerState struct {
	ID        string
	X, Y      float64
	Direction string
	Online    bool
}

// World holds the live state and the connected clients for a single world_id.
// All access goes through the mutex; nothing in here touches the database.
type World struct {
	ID string

	mu      sync.RWMutex
	players map[string]*PlayerState // playerID -> state (persists across reconnects)
	clients map[string]Conn         // playerID -> active connection (at most one)
}

func newWorld(id string) *World {
	return &World{
		ID:      id,
		players: make(map[string]*PlayerState),
		clients: make(map[string]Conn),
	}
}

// Register attaches a connection to the world. If a state already exists for
// the player (reconnect) it is reused so the position is preserved. Any
// previously attached connection for the same player is returned so the caller
// can close it.
func (w *World) Register(c Conn) (snapshot []PlayerSnapshot, replaced Conn) {
	w.mu.Lock()
	defer w.mu.Unlock()

	pid := c.PlayerID()
	replaced = w.clients[pid]

	st, ok := w.players[pid]
	if !ok {
		st = &PlayerState{ID: pid, X: WorldWidth / 2, Y: WorldHeight / 2, Direction: "down"}
		w.players[pid] = st
	}
	st.Online = true
	w.clients[pid] = c

	return w.snapshotLocked(), replaced
}

// Unregister detaches the given connection only if it is still the active one
// (guards against a stale client removing a reconnected session). Returns true
// when the player went offline as a result.
func (w *World) Unregister(c Conn) bool {
	w.mu.Lock()
	defer w.mu.Unlock()

	pid := c.PlayerID()
	if w.clients[pid] != c {
		return false // a newer client replaced this one; nothing to do
	}
	delete(w.clients, pid)
	if st, ok := w.players[pid]; ok {
		st.Online = false
	}
	return true
}

// ApplyMove validates and stores an authoritative position, clamped to bounds.
func (w *World) ApplyMove(playerID string, x, y float64, dir string) (PlayerSnapshot, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	st, ok := w.players[playerID]
	if !ok {
		return PlayerSnapshot{}, false
	}
	st.X = clamp(x, 0, WorldWidth)
	st.Y = clamp(y, 0, WorldHeight)
	if isValidDirection(dir) {
		st.Direction = dir
	}
	return snapshotOf(st), true
}

// PlayerSnapshot returns the current snapshot for a single player.
func (w *World) PlayerSnapshot(id string) (PlayerSnapshot, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	if st, ok := w.players[id]; ok {
		return snapshotOf(st), true
	}
	return PlayerSnapshot{}, false
}

// Broadcast sends raw bytes to every connected client, optionally skipping one
// player (pass "" to send to everyone, including the sender).
func (w *World) Broadcast(msg []byte, exclude string) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	for id, c := range w.clients {
		if id == exclude {
			continue
		}
		c.Enqueue(msg)
	}
}

// IsEmpty reports whether the world has no active connections.
func (w *World) IsEmpty() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return len(w.clients) == 0
}

// OnlineCount returns the number of currently connected clients.
func (w *World) OnlineCount() int {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return len(w.clients)
}

func (w *World) snapshotLocked() []PlayerSnapshot {
	out := make([]PlayerSnapshot, 0, len(w.players))
	for _, st := range w.players {
		out = append(out, snapshotOf(st))
	}
	return out
}

func snapshotOf(st *PlayerState) PlayerSnapshot {
	return PlayerSnapshot{ID: st.ID, X: st.X, Y: st.Y, Direction: st.Direction, Online: st.Online}
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func isValidDirection(d string) bool {
	switch d {
	case "up", "down", "left", "right":
		return true
	default:
		return false
	}
}
