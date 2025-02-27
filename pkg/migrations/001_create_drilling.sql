-- Enable UUID extension for drills
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drill Versions Table (Dynamic Versions)
CREATE TABLE drill_versions (
    version_id SERIAL PRIMARY KEY,
    version_name TEXT UNIQUE NOT NULL -- Drill version (e.g., "BASIC_VERSION", "PREMIUM_VERSION")
);

-- Drill Configurations Table (Dynamic Configurations)
CREATE TABLE drill_configs (
    config_id SERIAL PRIMARY KEY,
    config_name TEXT UNIQUE NOT NULL -- Name of drill configuration (e.g., "BASIC_CONFIG")
);

-- Drills Table (References `drill_configs` and `drill_versions`)
CREATE TABLE drills (
    drill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id INT NOT NULL REFERENCES drill_configs(config_id) ON DELETE RESTRICT,
    version_id INT NOT NULL REFERENCES drill_versions(version_id) ON DELETE RESTRICT,
    extractor_allowed BOOLEAN DEFAULT FALSE,
    level SMALLINT DEFAULT 1 CHECK (level >= 1),
    actual_eff INT DEFAULT 0 CHECK (actual_eff >= 0)
);

-- Drilling Sessions Table
CREATE TABLE drilling_sessions (
    session_id SERIAL PRIMARY KEY,
    operator_id UUID NOT NULL REFERENCES operators(operator_id) ON DELETE CASCADE,
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP NULL,
    earned_hash FLOAT DEFAULT 0.0 CHECK (earned_hash >= 0)
);

-- Drilling Cycles Table
CREATE TABLE drilling_cycles (
    cycle_id SERIAL PRIMARY KEY, -- Auto-increments, also serves as cycle number.
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP NULL,
    extractor_id UUID REFERENCES drills(drill_id) ON DELETE SET NULL,
    active_operators INT DEFAULT 0 CHECK (active_operators >= 0),
    cycle_complexity INT DEFAULT 1 CHECK (cycle_complexity >= 1),
    issued_hash FLOAT DEFAULT 0.0 CHECK (issued_hash >= 0)
);