package handlers

import (
	"encoding/json"
	"fmt"

	"github.com/NotBoringCompany/hashland-api/internal/services"
	"github.com/gofiber/fiber/v2"
)

// CreatePoolAdminHandler handles admin pool creation.
func CreatePoolAdminHandler(c *fiber.Ctx) error {
	// Log request
	fmt.Println("✅ CreatePoolAdminHandler was called!")

	// Parse request body
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		fmt.Println("❌ Failed to parse body:", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON"})
	}

	// Extract values safely
	adminPassword, _ := body["admin_password"].(string)
	leaderIDStr, _ := body["leader_id"].(string) // ✅ No need to parse to UUID here

	// Convert max_operators to int
	var maxOperators int
	if val, ok := body["max_operators"].(float64); ok {
		maxOperators = int(val)
	} else {
		fmt.Println("❌ max_operators is missing or invalid")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid max_operators"})
	}

	// Convert reward_system map to JSON string
	rewardSystemJSON, err := json.Marshal(body["reward_system"])
	if err != nil {
		fmt.Println("❌ Failed to serialize reward_system:", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid reward_system"})
	}

	// Convert join_prerequisites (optional) to JSON string
	joinPrerequisitesJSON := "{}" // Default to empty JSON object
	if jp, ok := body["join_prerequisites"]; ok {
		if jpMap, valid := jp.(map[string]interface{}); valid {
			joinPrerequisitesJSONBytes, err := json.Marshal(jpMap)
			if err == nil {
				joinPrerequisitesJSON = string(joinPrerequisitesJSONBytes)
			}
		}
	}

	// Call service layer (✅ No UUID conversion here, it's handled in the service)
	poolID, err := services.CreatePoolAdminService(adminPassword, leaderIDStr, maxOperators, string(rewardSystemJSON), joinPrerequisitesJSON)
	if err != nil {
		fmt.Println("❌ CreatePoolAdminService failed:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Success
	return c.JSON(fiber.Map{"message": "Pool created successfully!", "pool_id": poolID})
}
