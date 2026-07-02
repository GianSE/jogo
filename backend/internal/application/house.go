package application

import (
	"context"
	"errors"
)

var ErrInvalidFurnitureItem = errors.New("house: unknown or non-furniture item slug")
var ErrFurnitureNotFound = errors.New("house: furniture not found")

// FurnitureView is the read model for a placed furniture piece, safe to send over the wire.
type FurnitureView struct {
	ID       string `json:"id"`
	ItemSlug string `json:"item_slug"`
	PlacedBy string `json:"placed_by"` // placer handle
	X        int    `json:"x"`
	Y        int    `json:"y"`
	Rotation int16  `json:"rotation"`
	ZIndex   int    `json:"z_index"`
}

// HouseStore is the persistence port for house/furniture operations.
type HouseStore interface {
	// PlaceFurniture atomically ensures the house exists and inserts the piece.
	// Returns ErrInvalidFurnitureItem if the slug is unknown or not 'furniture' category.
	PlaceFurniture(ctx context.Context, worldID, userID, itemSlug string, x, y int, rotation int16) (FurnitureView, error)
	// RemoveFurniture deletes a piece by ID, scoped to the world.
	RemoveFurniture(ctx context.Context, furnitureID, worldID string) error
	// ListFurniture returns all furniture in a world's house ordered by z_index then created_at.
	ListFurniture(ctx context.Context, worldID string) ([]FurnitureView, error)
}

type HouseService struct {
	store HouseStore
}

func NewHouseService(store HouseStore) *HouseService {
	return &HouseService{store: store}
}

const (
	houseMaxCol = 9 // 10 columns, 0-indexed
	houseMaxRow = 7 // 8 rows, 0-indexed
)

// Place validates coords/rotation and persists the furniture placement.
func (s *HouseService) Place(ctx context.Context, worldID, userID, itemSlug string, x, y int, rotation int16) (FurnitureView, error) {
	switch rotation {
	case 0, 90, 180, 270:
	default:
		rotation = 0
	}
	if x < 0 {
		x = 0
	}
	if x > houseMaxCol {
		x = houseMaxCol
	}
	if y < 0 {
		y = 0
	}
	if y > houseMaxRow {
		y = houseMaxRow
	}
	return s.store.PlaceFurniture(ctx, worldID, userID, itemSlug, x, y, rotation)
}

// Remove deletes a furniture piece from the world's house.
func (s *HouseService) Remove(ctx context.Context, furnitureID, worldID string) error {
	return s.store.RemoveFurniture(ctx, furnitureID, worldID)
}

// Layout returns the current furniture layout for a world's house.
func (s *HouseService) Layout(ctx context.Context, worldID string) ([]FurnitureView, error) {
	return s.store.ListFurniture(ctx, worldID)
}
