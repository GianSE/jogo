package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gianpedrodev/casinha/backend/internal/domain"
)

type WorldRepo struct {
	pool *pgxpool.Pool
}

func NewWorldRepo(pool *pgxpool.Pool) *WorldRepo {
	return &WorldRepo{pool: pool}
}

// EnsureByInviteCode returns the world for an invite code, creating it if
// absent (owned by createdBy). Idempotent via the no-op DO UPDATE.
func (r *WorldRepo) EnsureByInviteCode(ctx context.Context, code, name, createdBy string) (*domain.World, error) {
	const q = `
		INSERT INTO worlds (name, invite_code, created_by)
		VALUES ($1, $2, $3::uuid)
		ON CONFLICT (invite_code) DO UPDATE SET invite_code = worlds.invite_code
		RETURNING id::text, name, invite_code, created_by::text, created_at, updated_at`

	var w domain.World
	err := r.pool.QueryRow(ctx, q, name, code, createdBy).Scan(
		&w.ID, &w.Name, &w.InviteCode, &w.CreatedBy, &w.CreatedAt, &w.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &w, nil
}
