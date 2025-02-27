package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// Pool represents a pool of operators who facilitate drilling, combining their cumulative efficiency ratings and
// increasing their chances of becoming an extractor, earning higher shared $HASH rewards.
type Pool struct {
	PoolID   int       `json:"pool_id" db:"pool_id"`     // The pool's auto-incrementing database ID.
	LeaderID uuid.UUID `json:"leader_id" db:"leader_id"` // The database ID of the pool's leader (operator).

	// The maximum number of operators allowed in the pool.
	// If this value is null, the pool has no limit on the number of operators.
	MaxOperators sql.NullInt64 `json:"max_operators" db:"max_operators"`

	RewardSystem      PoolRewardSystem      `json:"reward_system" db:"reward_system"`           // The pool's reward system.
	JoinPrerequisites PoolJoinPrerequisites `json:"join_prerequisites" db:"join_prerequisites"` // The prerequisites to join the pool.
}

// PoolRewardSystem defines how rewards are distributed within a pool.
type PoolRewardSystem struct {
	ExtractorOperator   float64 `json:"extractor_operator"`    // % reward for the extractor operator.
	Leader              float64 `json:"leader"`                // % reward for the leader.
	ActivePoolOperators float64 `json:"active_pool_operators"` // % reward for all active operators.
}

// PoolJoinPrerequisites defines the conditions required to join the pool.
type PoolJoinPrerequisites struct {
	TGChannelID string `json:"tg_channel_id,omitempty"` // Channel ID the operator must join in Telegram (if applicable).
}

// PoolOperator represents an operator who is a member of the pool.
type PoolOperator struct {
	OperatorID      uuid.UUID `json:"operator_id" db:"operator_id"`           // The operator's database ID.
	PoolID          int       `json:"pool_id" db:"pool_id"`                   // The pool's auto-incrementing database ID.
	JoinedTimestamp time.Time `json:"joined_timestamp" db:"joined_timestamp"` // When the operator joined the pool.
}
