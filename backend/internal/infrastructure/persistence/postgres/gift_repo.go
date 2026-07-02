package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gianpedrodev/casinha/backend/internal/application"
	"github.com/gianpedrodev/casinha/backend/internal/domain"
)

type GiftRepo struct {
	pool *pgxpool.Pool
}

func NewGiftRepo(pool *pgxpool.Pool) *GiftRepo {
	return &GiftRepo{pool: pool}
}

// Create inserts a gift using a SELECT-based INSERT so the item UUID is resolved
// atomically by slug + category check. Returns ErrInvalidGiftItem when the slug
// does not match a 'gift'-category item.
func (r *GiftRepo) Create(
	ctx context.Context,
	worldID, fromUserID, itemSlug string,
	scene domain.Scene,
	x, y int,
	message *string,
) (application.GiftView, error) {
	const q = `
		WITH inserted AS (
			INSERT INTO gifts (world_id, item_id, from_user_id, scene, x, y, message)
			SELECT $1::uuid, i.id, $2::uuid, $3, $4, $5, $6
			FROM items i
			WHERE i.slug = $7 AND i.category = 'gift'
			RETURNING id, item_id, from_user_id, scene, x, y, message, created_at
		)
		SELECT ins.id::text, it.slug, u.handle, ins.scene, ins.x, ins.y, ins.message, ins.created_at
		FROM inserted ins
		JOIN items it ON it.id = ins.item_id
		JOIN users u  ON u.id  = ins.from_user_id`

	var v application.GiftView
	err := r.pool.QueryRow(ctx, q, worldID, fromUserID, string(scene), x, y, message, itemSlug).
		Scan(&v.ID, &v.ItemSlug, &v.From, &v.Scene, &v.X, &v.Y, &v.Message, &v.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return application.GiftView{}, application.ErrInvalidGiftItem
	}
	return v, err
}

// ListActive returns all un-picked gifts in a world, joined with item slug and
// sender handle, ordered by drop time.
func (r *GiftRepo) ListActive(ctx context.Context, worldID string) ([]application.GiftView, error) {
	const q = `
		SELECT g.id::text, it.slug, u.handle, g.scene, g.x, g.y, g.message, g.created_at
		FROM gifts g
		JOIN items it ON it.id = g.item_id
		JOIN users u  ON u.id  = g.from_user_id
		WHERE g.world_id = $1::uuid AND g.picked_up = false
		ORDER BY g.created_at ASC`

	rows, err := r.pool.Query(ctx, q, worldID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []application.GiftView
	for rows.Next() {
		var v application.GiftView
		if err := rows.Scan(&v.ID, &v.ItemSlug, &v.From, &v.Scene, &v.X, &v.Y, &v.Message, &v.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// MarkPickedUp sets picked_up = true and records who picked it up. The DB CHECK
// constraint requires picked_up_by to be set; without it the UPDATE would be
// rejected. Idempotent: already-picked gifts are a silent no-op.
func (r *GiftRepo) MarkPickedUp(ctx context.Context, giftID, pickedUpByUserID string) error {
	const q = `
		UPDATE gifts
		SET picked_up = true, picked_up_by = $2::uuid, picked_up_at = now()
		WHERE id = $1::uuid AND picked_up = false`
	_, err := r.pool.Exec(ctx, q, giftID, pickedUpByUserID)
	return err
}
