package application

import (
	"context"
	"strings"

	"github.com/gianpedrodev/casinha/backend/internal/domain"
)

// Ports the bootstrap needs from persistence.
type UserEnsurer interface {
	EnsureByHandle(ctx context.Context, handle, email string) (*domain.User, error)
}

type WorldEnsurer interface {
	EnsureByInviteCode(ctx context.Context, code, name, createdBy string) (*domain.World, error)
}

// BootstrapService provisions the identity needed for a session. For the MVP it
// backs the dev-token flow: given a handle and a world code it get-or-creates a
// real user + world (with UUIDs) so gameplay events can persist with valid
// foreign keys. Real registration / invite-code auth replaces this later.
type BootstrapService struct {
	users  UserEnsurer
	worlds WorldEnsurer
}

func NewBootstrapService(users UserEnsurer, worlds WorldEnsurer) *BootstrapService {
	return &BootstrapService{users: users, worlds: worlds}
}

// EnsureDevSession returns the persisted user ID and world ID for a handle +
// world code, creating either as needed.
func (s *BootstrapService) EnsureDevSession(ctx context.Context, handle, code string) (userID, worldID string, err error) {
	handle = strings.TrimSpace(handle)
	email := strings.ToLower(handle) + "@dev.local"

	u, err := s.users.EnsureByHandle(ctx, handle, email)
	if err != nil {
		return "", "", err
	}

	w, err := s.worlds.EnsureByInviteCode(ctx, normalizeInviteCode(code), "Nossa Ilha", u.ID)
	if err != nil {
		return "", "", err
	}

	return u.ID, w.ID, nil
}

// normalizeInviteCode coerces a free-form dev code into the 4-12 char range the
// worlds.invite_code constraint requires, deterministically.
func normalizeInviteCode(code string) string {
	code = strings.TrimSpace(code)
	for len(code) < 4 {
		code += "0"
	}
	if len(code) > 12 {
		code = code[:12]
	}
	return code
}
