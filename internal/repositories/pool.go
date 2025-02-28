package repositories

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/NotBoringCompany/hashland-api/internal/models"
	"github.com/NotBoringCompany/hashland-api/pkg/db"
)

// CreatePoolAdmin is a version of `CreatePool` that bypasses the prerequisites for opening a pool. Only callable by admin.
// Handles the database query and logic for creating a new pool.
func CreatePoolAdmin(pool models.Pool) (int, error) {
	var poolID int
	query := `
		INSERT INTO pools (leader_id, max_operators, reward_system, join_prerequisites)
		VALUES ($1, $2, $3, $4) RETURNING pool_id
	`

	// Convert PoolRewardSystem and PoolJoinPrerequisites to JSONB
	rewardSystemJSON, err := json.Marshal(pool.RewardSystem)
	if err != nil {
		return 0, fmt.Errorf("(CreatePoolAdmin) Failed to serialize reward system: %w", err)
	}

	joinPrerequisitesJSON, err := json.Marshal(pool.JoinPrerequisites)
	if err != nil {
		return 0, fmt.Errorf("(CreatePoolAdmin) Failed to serialize join prerequisites: %w", err)
	}

	// Execute query
	err = db.DB.QueryRow(
		context.Background(),
		query,
		pool.LeaderID,
		pool.MaxOperators,
		rewardSystemJSON,
		joinPrerequisitesJSON,
	).Scan(&poolID)

	if err != nil {
		return 0, fmt.Errorf("failed to create pool: %w", err)
	}

	return poolID, nil
}
