"""Shared Pytest configuration and PostgreSQL fixtures for integration suites."""

import pathlib
import tempfile
import urllib.parse
from collections.abc import AsyncGenerator

import httpx
import psycopg
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from embedded_postgres import PostgresServer

from benchshield.api.app import create_app
from benchshield.api.auth import create_jwt_token
from benchshield.config import Settings, set_settings
from benchshield.persistence.database import close_database_connections

TEST_VAULT_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
TEST_JWT_SECRET = "test-integration-jwt-secret-key-32bytes-min!"


@pytest.fixture(scope="session")
def real_postgres_env():
    """Launch native embedded PostgreSQL server and initialize schemas and roles."""
    temp_dir = pathlib.Path(tempfile.mkdtemp(prefix="benchshield_pg_"))
    server = PostgresServer(temp_dir)
    server.ensure_postgres_running()
    superuser_uri = server.get_uri()

    # 1. Execute infra/postgres/init.sql using superuser
    init_sql_path = pathlib.Path(__file__).parents[3] / "infra" / "postgres" / "init.sql"
    if not init_sql_path.exists():
        init_sql_path = pathlib.Path(
            "c:/Users/rudi3/OneDrive/Desktop/tinyFish/infra/postgres/init.sql"
        )
    with open(init_sql_path) as f:
        init_sql = f.read()

    with psycopg.connect(superuser_uri, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(init_sql)
        # Create a separate database for migration upgrade/downgrade test
        cur.execute("CREATE DATABASE benchshield_migration_test OWNER benchshield_owner")

    # Also apply init.sql on the migration test database
    parsed = urllib.parse.urlparse(superuser_uri)
    host = parsed.hostname
    port = parsed.port
    mig_db_uri = f"postgresql://postgres:@{host}:{port}/benchshield_migration_test"
    with psycopg.connect(mig_db_uri, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(init_sql)

    dbname = parsed.path.lstrip("/")

    owner_sync_url = (
        f"postgresql+psycopg://benchshield_owner:owner_dev_password@{host}:{port}/{dbname}"
    )
    owner_raw_uri = f"postgresql://benchshield_owner:owner_dev_password@{host}:{port}/{dbname}"
    app_async_url = f"postgresql+asyncpg://benchshield_app:app_dev_password@{host}:{port}/{dbname}"
    verifier_async_url = (
        f"postgresql+asyncpg://benchshield_verifier:verifier_dev_password@{host}:{port}/{dbname}"
    )

    migration_owner_sync_url = f"postgresql+psycopg://benchshield_owner:owner_dev_password@{host}:{port}/benchshield_migration_test"
    migration_owner_raw_uri = f"postgresql://benchshield_owner:owner_dev_password@{host}:{port}/benchshield_migration_test"

    # 2. Run Alembic upgrade to head using owner role on main test db
    alembic_ini_path = pathlib.Path(__file__).parents[1] / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini_path))
    alembic_cfg.set_main_option("sqlalchemy.url", owner_sync_url)
    command.upgrade(alembic_cfg, "head")

    # 3. Seed test users and workspaces synchronously
    seed_sql = """
    INSERT INTO users (id, email, full_name, created_at) VALUES
    ('usr_alice', 'alice@corp-alpha.com', 'Alice Auditor', NOW()),
    ('usr_bob', 'bob@corp-beta.com', 'Bob Benchmark', NOW()),
    ('usr_charlie', 'charlie@corp-alpha.com', 'Charlie Observer', NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workspaces (id, name, created_at) VALUES
    ('ws_alpha', 'Alpha Research Labs', NOW()),
    ('ws_beta', 'Beta AI Systems', NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at) VALUES
    ('ws_alpha', 'usr_alice', 'admin', NOW()),
    ('ws_beta', 'usr_bob', 'admin', NOW()),
    ('ws_alpha', 'usr_charlie', 'viewer', NOW())
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
    """
    with psycopg.connect(superuser_uri, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(seed_sql)

    env_config = {
        "server": server,
        "superuser_uri": superuser_uri,
        "owner_sync_url": owner_sync_url,
        "owner_raw_uri": owner_raw_uri,
        "app_async_url": app_async_url,
        "verifier_async_url": verifier_async_url,
        "migration_owner_sync_url": migration_owner_sync_url,
        "migration_owner_raw_uri": migration_owner_raw_uri,
        "alembic_ini_path": str(alembic_ini_path),
    }

    yield env_config

    server.cleanup()


@pytest.fixture
def test_settings(real_postgres_env):
    """Return Settings pointing to embedded postgres test server."""
    return Settings(
        environment="test",
        database_url=real_postgres_env["app_async_url"],
        database_owner_sync_url=real_postgres_env["owner_sync_url"],
        database_verifier_url=real_postgres_env["verifier_async_url"],
        vault_encryption_key=TEST_VAULT_KEY_HEX,
        vault_key_version="v1",
        jwt_secret=TEST_JWT_SECRET,
        allow_insecure_auth_shortcuts=False,
    )


@pytest_asyncio.fixture
async def app_client(test_settings) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Create test client with active application and closed DB pools on teardown."""
    set_settings(test_settings)
    await close_database_connections()

    app = create_app(test_settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    await close_database_connections()
    set_settings(None)


def make_token(user_id: str, email: str, expires_in: int = 3600) -> str:
    return create_jwt_token(
        user_id=user_id,
        email=email,
        secret=TEST_JWT_SECRET,
        expires_in_seconds=expires_in,
    )


def auth_headers(token: str, workspace_id: str = "ws_alpha", extra: dict | None = None) -> dict:
    h = {
        "Authorization": f"Bearer {token}",
        "X-Workspace-ID": workspace_id,
    }
    if extra:
        h.update(extra)
    return h
