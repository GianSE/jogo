package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gianpedrodev/casinha/backend/internal/domain"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

// EnsureByHandle returns the user with the given handle, creating it if absent.
// The no-op DO UPDATE guarantees RETURNING yields the existing row on conflict.
func (r *UserRepo) EnsureByHandle(ctx context.Context, handle, email string) (*domain.User, error) {
	const q = `
		INSERT INTO users (email, handle, password_hash)
		VALUES ($1, $2, 'dev-no-auth')
		ON CONFLICT (handle) DO UPDATE SET handle = users.handle
		RETURNING id::text, email, handle, password_hash, created_at, updated_at`

	var u domain.User
	err := r.pool.QueryRow(ctx, q, email, handle).Scan(
		&u.ID, &u.Email, &u.Handle, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
