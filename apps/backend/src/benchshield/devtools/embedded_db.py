"""Embedded PostgreSQL bootstrap for tests, demos and the local dev server.

The embedded server listens on a Unix socket on Linux/macOS and on TCP on Windows,
so connection URLs are built from the superuser URI instead of assuming host:port.
"""

import pathlib
import urllib.parse

import psycopg

REPO_ROOT = pathlib.Path(__file__).resolve().parents[5]
BACKEND_ROOT = REPO_ROOT / "apps" / "backend"
INIT_SQL_PATH = REPO_ROOT / "infra" / "postgres" / "init.sql"

ROLE_PASSWORDS = {
    "benchshield_owner": "owner_dev_password",
    "benchshield_app": "app_dev_password",
    "benchshield_verifier": "verifier_dev_password",
    "postgres": "",
}

DEV_SEED_SQL = """
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


def build_url(superuser_uri: str, role: str, driver: str = "", dbname: str | None = None) -> str:
    """Build a connection URL for `role` against the same server as `superuser_uri`.

    driver: '' (libpq), 'psycopg' or 'asyncpg'.
    """
    parsed = urllib.parse.urlparse(superuser_uri)
    password = ROLE_PASSWORDS[role]
    netloc_host = parsed.hostname or ""
    if parsed.port:
        netloc_host = f"{netloc_host}:{parsed.port}"
    scheme = f"postgresql+{driver}" if driver else "postgresql"
    db = dbname or parsed.path.lstrip("/") or "postgres"
    url = f"{scheme}://{role}:{password}@{netloc_host}/{db}"
    if parsed.query:
        url = f"{url}?{parsed.query}"
    return url


def initialize_database(superuser_uri: str, extra_databases: list[str] | None = None) -> None:
    """Apply roles/schemas from infra/postgres/init.sql (idempotent)."""
    init_sql = INIT_SQL_PATH.read_text()
    with psycopg.connect(superuser_uri, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(init_sql)
        for db in extra_databases or []:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db,))
            if cur.fetchone() is None:
                cur.execute(f'CREATE DATABASE "{db}" OWNER benchshield_owner')
    for db in extra_databases or []:
        with psycopg.connect(build_url(superuser_uri, "postgres", dbname=db), autocommit=True) as c:
            c.execute(init_sql)


def run_migrations(owner_sync_url: str) -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", owner_sync_url.replace("%", "%%"))
    command.upgrade(cfg, "head")


def seed_dev_identities(superuser_uri: str) -> None:
    with psycopg.connect(superuser_uri, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(DEV_SEED_SQL)


def start_embedded_stack(data_dir: pathlib.Path) -> dict:
    """Start embedded Postgres, apply init.sql, migrate to head and seed dev identities."""
    from embedded_postgres import PostgresServer

    server = PostgresServer(data_dir)
    server.ensure_postgres_running()
    su = server.get_uri()
    initialize_database(su)
    owner_sync = build_url(su, "benchshield_owner", "psycopg")
    run_migrations(owner_sync)
    seed_dev_identities(su)
    return {
        "server": server,
        "superuser_uri": su,
        "owner_sync_url": owner_sync,
        "app_async_url": build_url(su, "benchshield_app", "asyncpg"),
        "verifier_async_url": build_url(su, "benchshield_verifier", "asyncpg"),
    }
