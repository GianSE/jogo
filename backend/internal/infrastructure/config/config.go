package config

import (
	"fmt"
	"os"
)

// Config holds runtime configuration loaded from environment variables.
type Config struct {
	Env           string // "development" | "production"
	Port          string
	DatabaseURL   string
	JWTSecret     string
	AllowedOrigin string // required in production; empty = allow all (dev only)
}

// Load reads configuration from the environment, applying sane defaults for
// local development and failing fast on missing required values in production.
func Load() (*Config, error) {
	cfg := &Config{
		Env:           getEnv("APP_ENV", "development"),
		Port:          getEnv("PORT", "8080"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		JWTSecret:     os.Getenv("JWT_SECRET"),
		AllowedOrigin: os.Getenv("ALLOWED_ORIGIN"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("config: DATABASE_URL is required")
	}

	return cfg, nil
}

func (c *Config) IsProduction() bool { return c.Env == "production" }

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
