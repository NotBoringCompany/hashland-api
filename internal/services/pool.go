package services

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/NotBoringCompany/hashland-api/internal/models"
	"github.com/NotBoringCompany/hashland-api/internal/repositories"
	"github.com/google/uuid"
)

// CreatePoolAdminService handles the logic for admin pool creation.
func CreatePoolAdminService(adminPassword string, leaderIDStr string, maxOperators int, rewardSystemJSON, joinPrerequisitesJSON string) (int, error) {
	// Validate Admin Password
	if adminPassword != os.Getenv("ADMIN_PASSWORD") {
		return 0, errors.New("(CreatePoolAdminService) unauthorized: invalid admin password")
	}

	// Validate LeaderID as UUID
	leaderID, err := uuid.Parse(leaderIDStr)
	if err != nil {
		return 0, fmt.Errorf("(CreatePoolAdminService) invalid leader_id: %w", err)
	}

	// Convert MaxOperators to sql.NullInt64 (handle unlimited case)
	var maxOps sql.NullInt64
	if maxOperators > 0 {
		maxOps = sql.NullInt64{Int64: int64(maxOperators), Valid: true}
	} else {
		maxOps = sql.NullInt64{Valid: false} // NULL in DB
	}

	// Parse RewardSystem JSON into struct
	var rewardSystem models.PoolRewardSystem
	if err := json.Unmarshal([]byte(rewardSystemJSON), &rewardSystem); err != nil {
		return 0, fmt.Errorf("(CreatePoolAdminService) invalid reward_system JSON: %w", err)
	}

	// Parse JoinPrerequisites JSON into struct (preserving individual null fields)
	var joinPrerequisites models.PoolJoinPrerequisites
	if joinPrerequisitesJSON != "" {
		if err := json.Unmarshal([]byte(joinPrerequisitesJSON), &joinPrerequisites); err != nil {
			return 0, fmt.Errorf("(CreatePoolAdminService) invalid join_prerequisites JSON: %w", err)
		}
	}

	// Prepare pool model
	pool := models.Pool{
		LeaderID:          leaderID,
		MaxOperators:      maxOps,
		RewardSystem:      rewardSystem,
		JoinPrerequisites: joinPrerequisites,
	}

	// Insert into database
	poolID, err := repositories.CreatePoolAdmin(pool)
	if err != nil {
		return 0, err
	}

	return poolID, nil
}
