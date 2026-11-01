import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure backend src is on path
current_dir = os.path.abspath(os.path.dirname(__file__))
backend_src = os.path.abspath(os.path.join(current_dir, "..", "src"))
if backend_src not in sys.path:
    sys.path.insert(0, backend_src)

from benchshield.config import get_settings
from benchshield.persistence.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    # If explicitly passed via Alembic config, use it
    main_url = config.get_main_option("sqlalchemy.url")
    if main_url and not main_url.startswith("postgresql://user:password@localhost/"):
        return main_url

    # Prefer env variable if set
    env_url = os.environ.get("BENCHSHIELD_DATABASE_OWNER_SYNC_URL")
    if env_url:
        return env_url
    try:
        settings = get_settings()
        return settings.database_owner_sync_url
    except Exception:
        return "postgresql://benchshield_owner:owner_dev_password@localhost:5432/benchshield"


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        version_table_schema="public",
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            version_table_schema="public",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
