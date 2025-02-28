-- Ensure UUID Extension Exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert Drill Versions
INSERT INTO drill_versions (version_name) VALUES 
    ('BASIC_VERSION'),
    ('PREMIUM_VERSION')
ON CONFLICT (version_name) DO NOTHING;

-- Insert Drill Configurations
INSERT INTO drill_configs (config_name) VALUES 
    ('BASIC_CONFIG'),
    ('IRONBORE_CONFIG'),
    ('BULWARK_CONFIG'),
    ('TITAN_CONFIG'),
    ('DREADNOUGHT_CONFIG')
ON CONFLICT (config_name) DO NOTHING;

-- Insert Shop Drills (Premium Drills Available for Purchase)
INSERT INTO shop_drills (drill_config_id, purchase_cost, base_eff, max_level, upgrade_costs)
VALUES 
(
    (SELECT config_id FROM drill_configs WHERE config_name = 'BASIC_CONFIG'),
    50.0, 
    100, 
    5, 
    '[{"level": 2, "upgrade_cost": 10.5}, {"level": 3, "upgrade_cost": 15.0}]'::jsonb
),
(
    (SELECT config_id FROM drill_configs WHERE config_name = 'IRONBORE_CONFIG'),
    100.0, 
    150, 
    6, 
    '[{"level": 2, "upgrade_cost": 20.0}, {"level": 3, "upgrade_cost": 30.0}]'::jsonb
)
ON CONFLICT (drill_config_id) DO NOTHING;

-- Insert Sample Operators
INSERT INTO operators (operator_id, username, tg_profile, weighted_asset_equity, max_eff_allowed, max_fuel, current_fuel)
VALUES 
    (uuid_generate_v4(), 'Operator1', '{"tg_id": "123456", "tg_username": "Op1TG"}'::jsonb, 500.0, 50000, 100, 100),
    (uuid_generate_v4(), 'Operator2', '{"tg_id": "654321", "tg_username": "Op2TG"}'::jsonb, 300.0, 30000, 80, 80)
ON CONFLICT (username) DO NOTHING;

-- Insert Sample Wallets (For Operators)
INSERT INTO operator_wallets (operator_id, address, chain)
VALUES 
(
    (SELECT operator_id FROM operators WHERE username = 'Operator1'),
    '0xABC123...',
    'ETH'
),
(
    (SELECT operator_id FROM operators WHERE username = 'Operator2'),
    '0xDEF456...',
    'TON'
)
ON CONFLICT (address) DO NOTHING;

-- Insert Sample Pools
INSERT INTO pools (leader_id, max_operators, reward_system, join_prerequisites)
VALUES 
(
    (SELECT operator_id FROM operators WHERE username = 'Operator1'),
    100,
    '{"extractor_operator": 48.0, "leader": 4.0, "active_pool_operators": 48.0}'::jsonb,
    '{"tg_channel_id": "1234567890"}'::jsonb
)
ON CONFLICT (leader_id) DO NOTHING;