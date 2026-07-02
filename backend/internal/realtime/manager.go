package realtime

import (
	"sync"
	"time"
)

// reconnectTTL is how long a world's state is kept alive after the last client
// disconnects, giving a player a window to rejoin and keep their position.
const reconnectTTL = 30 * time.Second

// Manager owns every live World keyed by world_id. It is the single in-memory
// source of truth for real-time state on this (single) backend instance.
type Manager struct {
	mu     sync.Mutex
	worlds map[string]*World
}

func NewManager() *Manager {
	return &Manager{worlds: make(map[string]*World)}
}

// World returns the World for id, creating it on first use.
func (m *Manager) World(id string) *World {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.worlds[id]
	if !ok {
		w = newWorld(id)
		m.worlds[id] = w
	}
	return w
}

// ScheduleDrop removes a world after reconnectTTL, but only if it is still
// empty at that point. This preserves player positions across brief reconnects.
func (m *Manager) ScheduleDrop(id string) {
	time.AfterFunc(reconnectTTL, func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		if w, ok := m.worlds[id]; ok && w.IsEmpty() {
			delete(m.worlds, id)
		}
	})
}
