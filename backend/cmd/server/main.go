package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gianpedrodev/casinha/backend/internal/application"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/auth"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/config"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/httpapi"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/persistence/postgres"
	"github.com/gianpedrodev/casinha/backend/internal/infrastructure/ws"
	"github.com/gianpedrodev/casinha/backend/internal/realtime"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("fatal: %v", err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Apply database migrations before serving traffic.
	if err := postgres.Migrate(cfg.DatabaseURL); err != nil {
		return err
	}
	log.Println("migrations applied")

	ctx := context.Background()
	pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	log.Println("database connected")

	// Persistence repositories.
	userRepo := postgres.NewUserRepo(pool)
	worldRepo := postgres.NewWorldRepo(pool)
	messageRepo := postgres.NewMessageRepo(pool)
	giftRepo := postgres.NewGiftRepo(pool)
	houseRepo := postgres.NewHouseRepo(pool)
	memoryRepo := postgres.NewMemoryRepo(pool)

	// Application services.
	bootstrap := application.NewBootstrapService(userRepo, worldRepo)
	chatService := application.NewChatService(messageRepo)
	giftService := application.NewGiftService(giftRepo)
	houseService := application.NewHouseService(houseRepo)
	memoryService := application.NewMemoryService(memoryRepo)

	// Real-time core: in-memory world manager + JWT-authenticated socket.
	manager := realtime.NewManager()
	signer := auth.NewSigner(cfg.JWTSecret, 24*time.Hour)
	wsHandler := ws.NewHandler(manager, signer, chatService, giftService, houseService, memoryService, cfg.AllowedOrigin)

	router := httpapi.NewRouter(cfg, pool, wsHandler, signer, bootstrap)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Run server in a goroutine so the main goroutine can wait for signals.
	go func() {
		log.Printf("listening on :%s (env=%s)", cfg.Port, cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	log.Println("stopped")
	return nil
}
