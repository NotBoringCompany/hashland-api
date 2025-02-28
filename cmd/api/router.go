package api

import (
	"github.com/NotBoringCompany/hashland-api/internal/handlers"
	"github.com/gofiber/fiber/v2"
)

// SetupRoutes registers API routes.
func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// Pool-related routes
	pool := api.Group("/pool")
	pool.Post("/create-pool-admin", handlers.CreatePoolAdminHandler)
}
