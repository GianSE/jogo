package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gianpedrodev/casinha/backend/internal/application"
	"github.com/gianpedrodev/casinha/backend/internal/domain"
)

type MemoryRepo struct {
	pool *pgxpool.Pool
}

func NewMemoryRepo(pool *pgxpool.Pool) *MemoryRepo {
	return &MemoryRepo{pool: pool}
}

// CreateIfFirst inserts a milestone using ON CONFLICT DO NOTHING. The partial
// unique index uq_memories_first_kind (world_id, kind WHERE kind LIKE 'first_%')
// guarantees each first_* milestone is created at most once per world without
// any application-level locking. Returns (view, true, nil) on insert; returns
// (zero, false, nil) when the milestone already existed.
func (r *MemoryRepo) CreateIfFirst(
	ctx context.Context,
	worldID string,
	kind domain.MemoryKind,
	description string,
) (application.MemoryView, bool, error) {
	const q = `
		INSERT INTO memories (world_id, kind, description)
		VALUES ($1::uuid, $2, $3)
		ON CONFLICT DO NOTHING
		RETURNING id::text, kind, description, occurred_at`

	var v application.MemoryView
	err := r.pool.QueryRow(ctx, q, worldID, string(kind), description).
		Scan(&v.ID, &v.Kind, &v.Description, &v.OccurredAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return application.MemoryView{}, false, nil
	}
	if err != nil {
		return application.MemoryView{}, false, err
	}
	return v, true, nil
}

// ListByWorld returns all milestones for a world ordered by occurrence time.
func (r *MemoryRepo) ListByWorld(ctx context.Context, worldID string) ([]application.MemoryView, error) {
	const q = `
		SELECT id::text, kind, description, occurred_at
		FROM memories
		WHERE world_id = $1::uuid
		ORDER BY occurred_at ASC`

	rows, err := r.pool.Query(ctx, q, worldID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []application.MemoryView
	for rows.Next() {
		var v application.MemoryView
		if err := rows.Scan(&v.ID, &v.Kind, &v.Description, &v.OccurredAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
