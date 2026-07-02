package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gianpedrodev/casinha/backend/internal/application"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/auth"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/config"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/ws"
)

// NewRouter builds the Gin engine and registers all HTTP routes. Feature routes
// (auth, world bootstrap) are added in later phases. This phase adds the
// WebSocket endpoint and, in development only, a helper to mint test tokens.
func NewRouter(
	cfg *config.Config,
	pool *pgxpool.Pool,
	wsh *ws.Handler,
	signer *auth.Signer,
	bootstrap *application.BootstrapService,
) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery(), corsMiddleware())

	health := NewHealthHandler(pool)
	r.GET("/health", health.Live)
	r.GET("/health/db", health.Ready)

	// Real-time gameplay socket.
	r.GET("/ws", wsh.Connect)

	api := r.Group("/api")
	{
		// Phase 6+: api.POST("/auth/register", ...) etc.

		// Dev-only: get-or-create a user+world and mint a token to test the
		// socket before real auth exists.
		if !cfg.IsProduction() {
			api.POST("/dev/token", devTokenHandler(signer, bootstrap))
		}
	}

	return r
}

// corsMiddleware allows cross-origin requests from any origin in development.
// In production, Nginx terminates and adds the correct headers — this middleware
// is harmless there too since it only adds headers when Origin is present.
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Vary", "Origin")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func devTokenHandler(signer *auth.Signer, bootstrap *application.BootstrapService) gin.HandlerFunc {
	return func(c *gin.Context) {
		handle := c.Query("player_id")
		code := c.Query("world_id")
		if handle == "" || code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "player_id and world_id are required"})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		userID, worldID, err := bootstrap.EnsureDevSession(ctx, handle, code)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not bootstrap session"})
			return
		}

		token, err := signer.Issue(userID, worldID, handle)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"token": token})
	}
}
