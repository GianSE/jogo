package application

import (
	"context"
	"time"

	"github.com/gianpedrodev/casinha/backend/internal/domain"
)

// MemoryView is the read model for a milestone, safe to send over the wire.
type MemoryView struct {
	ID          string    `json:"id"`
	Kind        string    `json:"kind"`
	Description string    `json:"description"`
	OccurredAt  time.Time `json:"-"` // formatted as RFC3339 in the wire layer
}

// MemoryStore is the persistence port for memory milestones.
type MemoryStore interface {
	// CreateIfFirst inserts a milestone using ON CONFLICT DO NOTHING on the
	// partial unique index (world_id, kind WHERE kind LIKE 'first_%').
	// Returns the created view and true when a new row was inserted; returns
	// zero value and false when the milestone already existed.
	CreateIfFirst(ctx context.Context, worldID string, kind domain.MemoryKind, description string) (MemoryView, bool, error)
	ListByWorld(ctx context.Context, worldID string) ([]MemoryView, error)
}

type MemoryService struct {
	store MemoryStore
}

func NewMemoryService(store MemoryStore) *MemoryService {
	return &MemoryService{store: store}
}

// Record attempts to create a first_* milestone. Returns (view, true, nil) when
// a new milestone was created; (zero, false, nil) when it already existed.
func (s *MemoryService) Record(ctx context.Context, worldID string, kind domain.MemoryKind, description string) (MemoryView, bool, error) {
	return s.store.CreateIfFirst(ctx, worldID, kind, description)
}

// History returns all milestones for a world ordered by occurrence time.
func (s *MemoryService) History(ctx context.Context, worldID string) ([]MemoryView, error) {
	return s.store.ListByWorld(ctx, worldID)
}
