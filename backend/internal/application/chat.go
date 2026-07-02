// Package application holds use-case services that orchestrate domain logic and
// persistence. Services depend on narrow ports (interfaces) declared here and
// implemented by the infrastructure layer.
package application

import (
	"context"
	"errors"
	"strings"
	"time"
)

const (
	maxChatLen     = 500
	chatHistorySize = 50
)

// ChatMessageView is the read model for a chat message (sender as display name).
type ChatMessageView struct {
	ID        int64     `json:"id"`
	Sender    string    `json:"sender"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"at"`
}

// MessageStore is the persistence port the chat service needs.
type MessageStore interface {
	Insert(ctx context.Context, worldID, senderID, body string) (id int64, createdAt time.Time, err error)
	ListRecentViews(ctx context.Context, worldID string, limit int) ([]ChatMessageView, error)
}

var ErrInvalidMessage = errors.New("chat: message must be 1-500 characters")

type ChatService struct {
	store MessageStore
}

func NewChatService(store MessageStore) *ChatService {
	return &ChatService{store: store}
}

// Send validates, persists, and returns the stored message as a view. The
// sender's display handle is supplied by the caller (known from the session).
func (s *ChatService) Send(ctx context.Context, worldID, senderID, handle, body string) (ChatMessageView, error) {
	body = strings.TrimSpace(body)
	if body == "" || len(body) > maxChatLen {
		return ChatMessageView{}, ErrInvalidMessage
	}
	id, createdAt, err := s.store.Insert(ctx, worldID, senderID, body)
	if err != nil {
		return ChatMessageView{}, err
	}
	return ChatMessageView{ID: id, Sender: handle, Body: body, CreatedAt: createdAt}, nil
}

// History returns the most recent messages for a world, oldest first.
func (s *ChatService) History(ctx context.Context, worldID string) ([]ChatMessageView, error) {
	return s.store.ListRecentViews(ctx, worldID, chatHistorySize)
}
