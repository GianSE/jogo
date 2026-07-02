package ws

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/gianpedrodev/casinha/backend/internal/application"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/auth"
	"github.com/gianpedrodev/casinha/backend/internal/realtime"
)

// Handler upgrades HTTP requests to WebSocket connections and binds them to the
// correct world after authenticating the JWT.
type Handler struct {
	mgr           *realtime.Manager
	signer        *auth.Signer
	chat          *application.ChatService
	gifts         *application.GiftService
	house         *application.HouseService
	memories      *application.MemoryService
	allowedOrigin string
	upgrader      websocket.Upgrader
}

func NewHandler(
	mgr *realtime.Manager,
	signer *auth.Signer,
	chat *application.ChatService,
	gifts *application.GiftService,
	house *application.HouseService,
	memories *application.MemoryService,
	allowedOrigin string,
) *Handler {
	h := &Handler{
		mgr:           mgr,
		signer:        signer,
		chat:          chat,
		gifts:         gifts,
		house:         house,
		memories:      memories,
		allowedOrigin: allowedOrigin,
	}
	h.upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     h.checkOrigin,
	}
	return h
}

// checkOrigin allows all origins in development. In production, only the
// configured ALLOWED_ORIGIN is accepted to prevent cross-site WebSocket hijacking.
func (h *Handler) checkOrigin(r *http.Request) bool {
	if h.allowedOrigin == "" {
		return true // dev / unconfigured: allow all
	}
	return r.Header.Get("Origin") == h.allowedOrigin
}

// Connect handles GET /ws?token=<jwt>. The token determines both the player
// identity and the world; the client cannot choose either.
func (h *Handler) Connect(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}

	claims, err := h.signer.Verify(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return // upgrader already wrote the error response
	}

	// Public display id is the handle; fall back to the user UUID if absent.
	publicID := claims.Handle
	if publicID == "" {
		publicID = claims.UserID()
	}

	world := h.mgr.World(claims.WorldID)
	client := newClient(conn, h.mgr, world, h.chat, h.gifts, h.house, h.memories, publicID, claims.UserID(), claims.WorldID)
	client.serve()
}
