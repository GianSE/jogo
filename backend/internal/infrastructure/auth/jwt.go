// Package auth provides minimal JWT signing/verification. Full registration and
// login endpoints arrive in a later phase; for now this issues and validates
// the tokens used to authenticate WebSocket connections.
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims carries the player identity and the world the token grants access to.
// Subject is the persisted user UUID; Handle is the public display name used as
// the realtime player id; WorldID is the persisted world UUID.
type Claims struct {
	WorldID string `json:"world_id"`
	Handle  string `json:"handle"`
	jwt.RegisteredClaims
}

// UserID is the persisted user UUID (token subject).
func (c Claims) UserID() string { return c.Subject }

// Signer issues and verifies HS256 tokens with a shared secret.
type Signer struct {
	secret []byte
	ttl    time.Duration
}

func NewSigner(secret string, ttl time.Duration) *Signer {
	return &Signer{secret: []byte(secret), ttl: ttl}
}

// Issue creates a signed token binding a user (UUID) + display handle to a world.
func (s *Signer) Issue(userID, worldID, handle string) (string, error) {
	now := time.Now()
	claims := Claims{
		WorldID: worldID,
		Handle:  handle,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

// Verify parses and validates a token, returning its claims.
func (s *Signer) Verify(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("auth: unexpected signing method")
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}
	if claims.Subject == "" || claims.WorldID == "" {
		return nil, errors.New("auth: token missing subject or world_id")
	}
	return claims, nil
}
