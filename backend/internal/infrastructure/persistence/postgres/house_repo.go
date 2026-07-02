package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gianpedrodev/casinha/backend/internal/application"
)

type HouseRepo struct {
	pool *pgxpool.Pool
}

func NewHouseRepo(pool *pgxpool.Pool) *HouseRepo {
	return &HouseRepo{pool: pool}
}

// PlaceFurniture upserts the house for the world and inserts a furniture piece,
// resolving the item UUID by slug + category check atomically in one CTE.
// Returns ErrInvalidFurnitureItem when the slug is unknown or not 'furniture'.
func (r *HouseRepo) PlaceFurniture(
	ctx context.Context,
	worldID, userID, itemSlug string,
	x, y int,
	rotation int16,
) (application.FurnitureView, error) {
	const q = `
		WITH house AS (
			INSERT INTO houses (world_id)
			VALUES ($1::uuid)
			ON CONFLICT (world_id) DO UPDATE SET updated_at = now()
			RETURNING id
		),
		inserted AS (
			INSERT INTO furniture (house_id, item_id, x, y, rotation, placed_by)
			SELECT h.id, i.id, $3, $4, $5, $2::uuid
			FROM house h, items i
			WHERE i.slug = $6 AND i.category = 'furniture'
			RETURNING id, item_id, placed_by, x, y, rotation, z_index
		)
		SELECT ins.id::text, it.slug, COALESCE(u.handle, ''), ins.x, ins.y, ins.rotation, ins.z_index
		FROM inserted ins
		JOIN items it  ON it.id = ins.item_id
		LEFT JOIN users u ON u.id = ins.placed_by`

	var v application.FurnitureView
	err := r.pool.QueryRow(ctx, q, worldID, userID, x, y, rotation, itemSlug).
		Scan(&v.ID, &v.ItemSlug, &v.PlacedBy, &v.X, &v.Y, &v.Rotation, &v.ZIndex)
	if errors.Is(err, pgx.ErrNoRows) {
		return application.FurnitureView{}, application.ErrInvalidFurnitureItem
	}
	return v, err
}

// RemoveFurniture deletes a piece by ID scoped to the world to prevent
// cross-world removals.
func (r *HouseRepo) RemoveFurniture(ctx context.Context, furnitureID, worldID string) error {
	const q = `
		DELETE FROM furniture
		USING houses
		WHERE furniture.id = $1::uuid
		  AND furniture.house_id = houses.id
		  AND houses.world_id = $2::uuid`
	_, err := r.pool.Exec(ctx, q, furnitureID, worldID)
	return err
}

// ListFurniture returns all furniture in a world's house ordered by z_index
// then creation time so later-placed items render on top.
func (r *HouseRepo) ListFurniture(ctx context.Context, worldID string) ([]application.FurnitureView, error) {
	const q = `
		SELECT f.id::text, i.slug, COALESCE(u.handle, ''), f.x, f.y, f.rotation, f.z_index
		FROM furniture f
		JOIN houses h  ON h.id = f.house_id
		JOIN items i   ON i.id = f.item_id
		LEFT JOIN users u ON u.id = f.placed_by
		WHERE h.world_id = $1::uuid
		ORDER BY f.z_index ASC, f.created_at ASC`

	rows, err := r.pool.Query(ctx, q, worldID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []application.FurnitureView
	for rows.Next() {
		var v application.FurnitureView
		if err := rows.Scan(&v.ID, &v.ItemSlug, &v.PlacedBy, &v.X, &v.Y, &v.Rotation, &v.ZIndex); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
