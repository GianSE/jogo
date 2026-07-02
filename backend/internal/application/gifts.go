package application

import (
	"context"
	"errors"
	"time"

	"github.com/gianpedrodev/casinha/backend/internal/domain"
)

var ErrInvalidGiftItem = errors.New("gifts: unknown or non-gift item slug")
var ErrGiftNotFound = errors.New("gifts: gift not found or already picked up")

// GiftView is the read model for a gift, safe to send over the wire.
type GiftView struct {
	ID        string         `json:"id"`
	ItemSlug  string         `json:"item_slug"`
	From      string         `json:"from"`  // sender handle
	Scene     domain.Scene   `json:"scene"`
	X         int            `json:"x"`
	Y         int            `json:"y"`
	Message   *string        `json:"message,omitempty"`
	CreatedAt time.Time      `json:"-"`
}

// GiftStore is the persistence port the gift service needs. The Postgres repo
// implements this interface; the method set is narrower than the full domain
// GiftRepository so the service is decoupled from domain details.
type GiftStore interface {
	// Create inserts a gift using itemSlug to validate + resolve the item FK
	// in a single atomic query. Returns ErrInvalidGiftItem if slug is unknown
	// or is not in the 'gift' category.
	Create(ctx context.Context, worldID, fromUserID, itemSlug string, scene domain.Scene, x, y int, message *string) (GiftView, error)
	ListActive(ctx context.Context, worldID string) ([]GiftView, error)
	MarkPickedUp(ctx context.Context, giftID, pickedUpByUserID string) error
}

type GiftService struct {
	store GiftStore
}

func NewGiftService(store GiftStore) *GiftService {
	return &GiftService{store: store}
}

// Drop persists a gift drop and returns the stored view for broadcast.
func (s *GiftService) Drop(
	ctx context.Context,
	worldID, fromUserID, itemSlug string,
	scene domain.Scene,
	x, y int,
	message *string,
) (GiftView, error) {
	if scene != domain.SceneIsland && scene != domain.SceneHouse {
		scene = domain.SceneIsland
	}
	// Clamp to world bounds matching the server (realtime/world.go).
	const maxX, maxY = 2000, 2000
	if x < 0 { x = 0 }
	if x > maxX { x = maxX }
	if y < 0 { y = 0 }
	if y > maxY { y = maxY }

	return s.store.Create(ctx, worldID, fromUserID, itemSlug, scene, x, y, message)
}

// ActiveGifts returns all un-picked gifts in a world (for history replay on join).
func (s *GiftService) ActiveGifts(ctx context.Context, worldID string) ([]GiftView, error) {
	return s.store.ListActive(ctx, worldID)
}

// Pickup marks a gift as collected by pickedUpByUserID (persisted UUID).
func (s *GiftService) Pickup(ctx context.Context, giftID, pickedUpByUserID string) error {
	return s.store.MarkPickedUp(ctx, giftID, pickedUpByUserID)
}
