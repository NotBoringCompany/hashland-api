package main

import (
	"log"
	"os"

	"github.com/NotBoringCompany/hashland-api/pkg/db"
	"github.com/NotBoringCompany/hashland-api/pkg/redis"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
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
	app.Use(cors.New())   // allows FE connections

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Hashland API is running!"})
	})

	// start the server
	log.Println("🚀 Server running on port", port)
	log.Fatal(app.Listen(":" + port))

}
