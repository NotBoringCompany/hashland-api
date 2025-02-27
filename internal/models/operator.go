package models

import (
	"time"

	"github.com/google/uuid"
)

// Operator represents a Hashland user who facilitates drilling and earns $HASH.
type Operator struct {
	OperatorID          uuid.UUID  `json:"operator_id" db:"operator_id"`                     // The operator's database ID.
	Username            string     `json:"username" db:"username"`                           // Unique username.
	CreatedTimestamp    time.Time  `json:"created_timestamp" db:"created_timestamp"`         // When the operator's account was created.
	WeightedAssetEquity float64    `json:"weighted_asset_equity" db:"weighted_asset_equity"` // USD value of USDT, USDC, TON held.
	MaxEffAllowed       uint       `json:"max_eff_allowed" db:"max_eff_allowed"`             // Max cumulative efficiency rating.
	MaxFuel             uint       `json:"max_fuel" db:"max_fuel"`                           // Maximum fuel capacity for all of the operator's drills.
	CurrentFuel         uint       `json:"current_fuel" db:"current_fuel"`                   // Current fuel available for all of the operator's drills.
	TGProfile           *TGProfile `json:"tg_profile,omitempty" db:"tg_profile"`             // Optional Telegram profile stored as JSONB.
}

// TGProfile represents Telegram authentication data stored as JSONB in the database.
type TGProfile struct {
	TGID       string `json:"tg_id"`                 // Telegram ID.
	TGUsername string `json:"tg_username,omitempty"` // Telegram username.
}

// OperatorWallet represents a wallet instance linked to an operator after wallet connection/linking.
type OperatorWallet struct {
	WalletID   int       `json:"wallet_id" db:"wallet_id"`           // The wallet's auto-incrementing database ID.
	OperatorID uuid.UUID `json:"operator_id" db:"operator_id"`       // The operator's database ID that this wallet is linked to.
	Address    string    `json:"address" db:"address"`               // The operator's wallet address.
	Chain      string    `json:"chain" db:"chain"`                   // The chain this wallet was connected to upon linking.
	Signature  string    `json:"signature,omitempty" db:"signature"` // The signature of the operator to verify wallet ownership.
}

// OperatorDrill represents a many-to-many relationship between operators and drills.
type OperatorDrill struct {
	OperatorID uuid.UUID `json:"operator_id" db:"operator_id"` // The operator's database ID.
	DrillID    uuid.UUID `json:"drill_id" db:"drill_id"`       // The drill's database ID.
}
