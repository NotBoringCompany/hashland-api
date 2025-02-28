-- Drop Shop Tables
DROP TABLE IF EXISTS shop_drills CASCADE;

-- Drop Pool Tables
DROP TABLE IF EXISTS pool_operators CASCADE;
DROP TABLE IF EXISTS pools CASCADE;

-- Drop Operator Tables
DROP TABLE IF EXISTS operator_wallets CASCADE;
DROP TABLE IF EXISTS operator_drills CASCADE;
DROP TABLE IF EXISTS operators CASCADE;

-- Drop Drilling Tables
DROP TABLE IF EXISTS drilling_sessions CASCADE;
DROP TABLE IF EXISTS drilling_cycles CASCADE;
DROP TABLE IF EXISTS drills CASCADE;
DROP TABLE IF EXISTS drill_configs CASCADE;
DROP TABLE IF EXISTS drill_versions CASCADE;

-- Drop Extensions
DROP EXTENSION IF EXISTS "uuid-ossp";