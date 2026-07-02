package domain

import (
	"context"
	"errors"
)

// ErrNotFound is returned by repositories when a record does not exist.
var ErrNotFound = errors.New("domain: not found")

// ErrWorldFull is returned when attempting to add a 3rd member to a world.
var ErrWorldFull = errors.New("domain: world already has two players")

// Repositories below are interfaces only; Postgres implementations live in
// infrastructure/persistence/postgres and are wired at startup. This is the
// seam that also lets the live-state store swap to Redis later.

type UserRepository interface {
	Create(ctx context.Context, u *User) error
	GetByID(ctx context.Context, id string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
}

type WorldRepository interface {
	Create(ctx context.Context, w *World) error
	GetByID(ctx context.Context, id string) (*World, error)
	GetByInviteCode(ctx context.Context, code string) (*World, error)
	GetByUserID(ctx context.Context, userID string) (*World, error)
}

type WorldPlayerRepository interface {
	Add(ctx context.Context, wp *WorldPlayer) error
	ListByWorld(ctx context.Context, worldID string) ([]WorldPlayer, error)
	CountByWorld(ctx context.Context, worldID string) (int, error)
}

type PlayerStateRepository interface {
	Upsert(ctx context.Context, s *PlayerState) error
	GetByWorldUser(ctx context.Context, worldID, userID string) (*PlayerState, error)
	ListByWorld(ctx context.Context, worldID string) ([]PlayerState, error)
}

type ItemRepository interface {
	GetBySlug(ctx context.Context, slug string) (*Item, error)
	List(ctx context.Context) ([]Item, error)
}

type InventoryRepository interface {
	AddQuantity(ctx context.Context, worldID, userID, itemID string, delta int) error
	ListByUser(ctx context.Context, worldID, userID string) ([]InventoryEntry, error)
}

type MessageRepository interface {
	Create(ctx context.Context, m *Message) error
	ListRecent(ctx context.Context, worldID string, limit int) ([]Message, error)
}

type GiftRepository interface {
	Create(ctx context.Context, g *Gift) error
	ListActive(ctx context.Context, worldID string) ([]Gift, error)
	MarkPickedUp(ctx context.Context, giftID, userID string) error
}

type HouseRepository interface {
	GetByWorld(ctx context.Context, worldID string) (*House, error)
	Create(ctx context.Context, h *House) error
}

type FurnitureRepository interface {
	ListByHouse(ctx context.Context, houseID string) ([]Furniture, error)
	Place(ctx context.Context, f *Furniture) error
	Move(ctx context.Context, f *Furniture) error
	Remove(ctx context.Context, furnitureID string) error
}

type MemoryRepository interface {
	// CreateIfFirst inserts a "first_*" memory, doing nothing if it already
	// exists for the world. Returns true when a new memory was created.
	CreateIfFirst(ctx context.Context, m *Memory) (bool, error)
	ListByWorld(ctx context.Context, worldID string) ([]Memory, error)
}
