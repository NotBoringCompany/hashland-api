package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/NotBoringCompany/hashland-api/internal/models"
	"github.com/NotBoringCompany/hashland-api/internal/repositories"
	"github.com/NotBoringCompany/hashland-api/pkg/db"
	"github.com/google/uuid"
)

func main() {
	// Initialize the database connection
	db.InitDB()

	// Convert LeaderID to UUID
	leaderID, err := uuid.NewV7()

	if err != nil {
		log.Fatalf("(local_test/main) Failed to generate UUID: %v", err)
	}

	// Convert MaxOperators to sql.NullInt64
	maxOperators := sql.NullInt64{Int64: 50, Valid: true}

	// Parse RewardSystem JSON into struct
	var rewardSystem models.PoolRewardSystem
	if err := json.Unmarshal([]byte(`{"extractor_operator": 48.0, "leader": 4.0, "active_pool_operators": 48.0}`), &rewardSystem); err != nil {
		log.Fatalf("(local_test/main) Failed to parse reward system: %v", err)
	}

	// Parse JoinPrerequisites JSON into struct
	var joinPrerequisites models.PoolJoinPrerequisites
	if err := json.Unmarshal([]byte(`{"tg_channel_id": "1234567890"}`), &joinPrerequisites); err != nil {
		log.Fatalf("(local_test/main) Failed to parse join prerequisites: %v", err)
	}

	// Define a test pool with correct data types
	testPool := models.Pool{
		LeaderID:          leaderID,
		MaxOperators:      maxOperators,
		RewardSystem:      rewardSystem,
		JoinPrerequisites: joinPrerequisites,
	}

	// Call CreatePoolAdmin function
	poolID, err := repositories.CreatePoolAdmin(testPool)
	if err != nil {
		log.Fatalf("(local_test/main) Failed to create pool: %v", err)
	}

	fmt.Printf("(local_test/main) ✅ Pool created successfully! Pool ID: %d\n", poolID)
}
