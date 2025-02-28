package repositories

import (
	"context"
	"fmt"

	"github.com/NotBoringCompany/hashland-api/internal/models"
	"github.com/NotBoringCompany/hashland-api/pkg/db"
)

// CreatePoolAdmin is a version of `CreatePool` that bypasses the prerequisites for opening a pool. Only callable by admin.
func CreatePoolAdmin(pool models.Pool) (int, error) {
	var poolID int
	query := `
		INSERT INTO pools (leader_id, max_operators, reward_system, join_prerequisites)
		VALUES ($1, $2, $3, $4) RETURNING pool_id
	`

	err := db.GetDB().QueryRow(
		context.Background(),
		query,
		pool.LeaderID,
		pool.MaxOperators,
		pool.RewardSystem,
		pool.JoinPrerequisites,
	).Scan(&poolID)

	if err != nil {
		return 0, fmt.Errorf("failed to create pool: %w", err)
	}

	return poolID, nil
}
