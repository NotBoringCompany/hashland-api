package models

import "github.com/google/uuid"

// ShopDrill represents a premium drill available for purchase in the shop.
type ShopDrill struct {
	ShopDrillID  uuid.UUID             `json:"shop_drill_id" db:"shop_drill_id"` // Unique ID for each shop drill entry.
	DrillConfig  DrillConfig           `json:"drill_config" db:"drill_config"`   // Which drill configuration this shop drill has.
	PurchaseCost float64               `json:"purchase_cost" db:"purchase_cost"` // Purchase cost in TON.
	BaseEff      uint32                `json:"base_eff" db:"base_eff"`           // Base efficiency rating of the drill.
	MaxLevel     uint8                 `json:"max_level" db:"max_level"`         // Maximum upgradeable level.
	UpgradeCosts []ShopItemUpgradeCost `json:"upgrade_costs" db:"upgrade_costs"` // Represents the cost to upgrade the drill (in TON) per level.
}

// ShopItemUpgradeCost represents the cost of upgrading a drill per level.
type ShopItemUpgradeCost struct {
	Level       uint8   `json:"level" db:"level"`               // Level to be upgraded to.
	UpgradeCost float64 `json:"upgrade_cost" db:"upgrade_cost"` // Cost in TON.
}
