-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Operators Table
CREATE TABLE operators (
    operator_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    created_timestamp TIMESTAMP DEFAULT NOW(),
    weighted_asset_equity FLOAT DEFAULT 0.0 CHECK (weighted_asset_equity >= 0),
    max_eff_allowed INT DEFAULT 0 CHECK (max_eff_allowed >= 0),
    max_fuel INT DEFAULT 100 CHECK (max_fuel >= 0),
    current_fuel INT DEFAULT 100 CHECK (current_fuel >= 0),
    tg_profile JSONB NULL -- Stores Telegram profile as JSONB
);

-- Operator Wallets Table (Each operator can have multiple wallets)
CREATE TABLE operator_wallets (
    wallet_id SERIAL PRIMARY KEY,
    operator_id UUID NOT NULL REFERENCES operators(operator_id) ON DELETE CASCADE,
    address TEXT UNIQUE NOT NULL,
    chain TEXT NOT NULL,
    signature TEXT NULL
);

-- Index for Faster Lookups
CREATE INDEX idx_operator_wallets_operator_id ON operator_wallets(operator_id);