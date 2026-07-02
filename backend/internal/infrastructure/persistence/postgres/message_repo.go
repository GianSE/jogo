package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gianpedrodev/casinha/backend/internal/application"
)

type MessageRepo struct {
	pool *pgxpool.Pool
}

func NewMessageRepo(pool *pgxpool.Pool) *MessageRepo {
	return &MessageRepo{pool: pool}
}

func (r *MessageRepo) Insert(ctx context.Context, worldID, senderID, body string) (int64, time.Time, error) {
	const q = `
		INSERT INTO messages (world_id, sender_id, body)
		VALUES ($1::uuid, $2::uuid, $3)
		RETURNING id, created_at`

	var id int64
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, q, worldID, senderID, body).Scan(&id, &createdAt)
	return id, createdAt, err
}

// ListRecentViews returns up to limit most recent messages joined with the
// sender's handle, ordered oldest-first for display.
func (r *MessageRepo) ListRecentViews(ctx context.Context, worldID string, limit int) ([]application.ChatMessageView, error) {
	const q = `
		SELECT t.id, u.handle, t.body, t.created_at
		FROM (
			SELECT id, sender_id, body, created_at
			FROM messages
			WHERE world_id = $1::uuid
			ORDER BY created_at DESC, id DESC
			LIMIT $2
		) t
		JOIN users u ON u.id = t.sender_id
		ORDER BY t.created_at ASC, t.id ASC`

	rows, err := r.pool.Query(ctx, q, worldID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []application.ChatMessageView
	for rows.Next() {
		var v application.ChatMessageView
		if err := rows.Scan(&v.ID, &v.Sender, &v.Body, &v.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
