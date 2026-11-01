-- Initialize BenchShield database schemas, roles, and restricted vault privileges

-- 1. Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS vault;

-- 2. Create roles with explicit passwords
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'benchshield_owner') THEN
        CREATE ROLE benchshield_owner WITH LOGIN PASSWORD 'owner_dev_password' CREATEDB;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'benchshield_app') THEN
        CREATE ROLE benchshield_app WITH LOGIN PASSWORD 'app_dev_password';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'benchshield_verifier') THEN
        CREATE ROLE benchshield_verifier WITH LOGIN PASSWORD 'verifier_dev_password';
    END IF;
END $$;

-- 3. Set ownership and database permissions
ALTER SCHEMA public OWNER TO benchshield_owner;
ALTER SCHEMA vault OWNER TO benchshield_owner;

GRANT ALL ON DATABASE postgres TO benchshield_owner;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_database WHERE datname = 'benchshield') THEN
        EXECUTE 'GRANT ALL ON DATABASE benchshield TO benchshield_owner';
    END IF;
END $$;

-- 4. Configure public schema access
GRANT USAGE ON SCHEMA public TO benchshield_app;
GRANT USAGE ON SCHEMA public TO benchshield_verifier;
GRANT ALL PRIVILEGES ON SCHEMA public TO benchshield_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO benchshield_app;
ALTER DEFAULT PRIVILEGES FOR ROLE benchshield_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO benchshield_app;
ALTER DEFAULT PRIVILEGES FOR ROLE benchshield_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO benchshield_app;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO benchshield_verifier;
ALTER DEFAULT PRIVILEGES FOR ROLE benchshield_owner IN SCHEMA public GRANT SELECT ON TABLES TO benchshield_verifier;

-- 5. Configure vault schema access (CRITICAL PRIVACY BOUNDARY)
-- Application runtime (benchshield_app) has INSERT ONLY into vault; SELECT IS STRICTLY REVOKED!
-- Verifier identity (benchshield_verifier) has SELECT access for trusted grading.
GRANT USAGE ON SCHEMA vault TO benchshield_app;
GRANT USAGE ON SCHEMA vault TO benchshield_verifier;
GRANT ALL PRIVILEGES ON SCHEMA vault TO benchshield_owner;

GRANT INSERT ON ALL TABLES IN SCHEMA vault TO benchshield_app;
ALTER DEFAULT PRIVILEGES FOR ROLE benchshield_owner IN SCHEMA vault GRANT INSERT ON TABLES TO benchshield_app;

GRANT SELECT ON ALL TABLES IN SCHEMA vault TO benchshield_verifier;
ALTER DEFAULT PRIVILEGES FOR ROLE benchshield_owner IN SCHEMA vault GRANT SELECT ON TABLES TO benchshield_verifier;
