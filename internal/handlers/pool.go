package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// CreatePoolAdminHandler handles admin pool creation.
func CreatePoolAdminHandler(c *fiber.Ctx) error {
	// Log incoming request
	fmt.Println("✅ CreatePoolAdminHandler was called!")

	// Debug: Print raw body
	fmt.Println("Raw body:", string(c.Body()))

	// Parse request body
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		fmt.Println("❌ Failed to parse body:", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON"})
	}

	// Debug: Print parsed body
	fmt.Println("Parsed body:", body)

	return c.JSON(fiber.Map{"message": "Pool creation received"})
	// type RequestBody struct {
	// 	AdminPassword     string  `json:"admin_password"`
	// 	LeaderID          string  `json:"leader_id"`
	// 	MaxOperators      int     `json:"max_operators"`                // -1 means unlimited
	// 	RewardSystem      string  `json:"reward_system"`                // JSON string
	// 	JoinPrerequisites *string `json:"join_prerequisites,omitempty"` // Allow nullable JSON
	// }

	// var body RequestBody
	// if err := c.BodyParser(&body); err != nil {
	// 	return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	// }

	// // Handle missing JoinPrerequisites (keep null if missing)
	// joinPrerequisites := ""
	// if body.JoinPrerequisites != nil {
	// 	joinPrerequisites = *body.JoinPrerequisites
	// }

	// // Call service function
	// poolID, err := services.CreatePoolAdminService(body.AdminPassword, body.LeaderID, body.MaxOperators, body.RewardSystem, joinPrerequisites)
	// if err != nil {
	// 	return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	// }

	// return c.Status(http.StatusCreated).JSON(fiber.Map{"message": "Pool created successfully", "pool_id": poolID})
}
