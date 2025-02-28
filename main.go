package main

import (
	"fmt"
	"log"
	"os"

	"github.com/NotBoringCompany/hashland-api/cmd/api"
	"github.com/NotBoringCompany/hashland-api/pkg/db"
	"github.com/NotBoringCompany/hashland-api/pkg/redis"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatal("(main) Error loading .env file (ignore if running on VPS)")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// init DB and redis
	db.InitDB()
	redis.InitRedis()

	app := fiber.New(fiber.Config{
		Network:      "tcp",
		ServerHeader: "Fiber",
		AppName:      "Hashland API",
	})

	app.Use(logger.New()) // logs all requests
	app.Use(cors.New(cors.Config{
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
	})) // allows FE connections

	api.SetupRoutes(app) // setup API routes

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Hashland API is running!"})
	})

	for _, route := range app.GetRoutes() {
		fmt.Println(route.Method, route.Path)
	}

	// start the server
	log.Println("🚀 Server running on port", port)
	log.Fatal(app.Listen(":" + port))

}
