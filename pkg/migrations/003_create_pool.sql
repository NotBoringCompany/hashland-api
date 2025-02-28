-- Enable UUID extension for operator references
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Pools Table (Stores pools and reward settings)
CREATE TABLE pools (
    pool_id SERIAL PRIMARY KEY,
    leader_id UUID UNIQUE NOT NULL REFERENCES operators(operator_id) ON DELETE CASCADE,
    max_operators INT DEFAULT NULL, -- NULL means unlimited members
    reward_system JSONB NOT NULL, -- Reward distribution stored as JSONB
    join_prerequisites JSONB NOT NULL -- Prerequisites stored as JSONB
);

-- Pool Membership Table (Tracks which operators belong to which pools)
CREATE TABLE pool_operators (
    operator_id UUID NOT NULL REFERENCES operators(operator_id) ON DELETE CASCADE,
    pool_id INT NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
    joined_timestamp TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (operator_id, pool_id)
);

-- Indexes for Faster Lookups
CREATE INDEX idx_pool_operators_operator_id ON pool_operators(operator_id);
CREATE INDEX idx_pool_operators_pool_id ON pool_operators(pool_id);