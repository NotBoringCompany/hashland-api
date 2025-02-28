-- Enable UUID extension for shop drill IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ShopDrills Table (Premium drills available for purchase)
CREATE TABLE shop_drills (
    shop_drill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drill_config_id INT NOT NULL REFERENCES drill_configs(config_id) ON DELETE RESTRICT,
    purchase_cost FLOAT NOT NULL CHECK (purchase_cost >= 0),
    base_eff INT NOT NULL CHECK (base_eff >= 0),
    max_level SMALLINT NOT NULL CHECK (max_level > 0),
    upgrade_costs JSONB NOT NULL, -- Stores level-based upgrade costs as JSONB
    UNIQUE (drill_config_id) -- Ensure uniqueness for `ON CONFLICT`
);