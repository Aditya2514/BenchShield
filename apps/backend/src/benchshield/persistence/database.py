"""Database engine, connection pooling, and session lifecycle management."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from benchshield.config import Settings, get_settings

_async_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None

_verifier_engine: AsyncEngine | None = None
_verifier_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_async_engine(settings: Settings | None = None) -> AsyncEngine:
    """Retrieve or create singleton application AsyncEngine."""
    global _async_engine
    if _async_engine is None:
        cfg = settings or get_settings()
        _async_engine = create_async_engine(
            cfg.database_url,
            echo=False,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
    return _async_engine


def get_session_factory(settings: Settings | None = None) -> async_sessionmaker[AsyncSession]:
    """Retrieve or create singleton async session factory for application runtime."""
    global _session_factory
    if _session_factory is None:
        engine = get_async_engine(settings)
        _session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factory


def get_verifier_session_factory(
    settings: Settings | None = None,
) -> async_sessionmaker[AsyncSession]:
    """Retrieve session factory using restricted verifier credentials."""
    global _verifier_engine, _verifier_session_factory
    if _verifier_session_factory is None:
        cfg = settings or get_settings()
        _verifier_engine = create_async_engine(
            cfg.database_verifier_url,
            echo=False,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        _verifier_session_factory = async_sessionmaker(
            _verifier_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _verifier_session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for yielding transactional database sessions."""
    factory = get_session_factory()
    async with factory() as session:
        yield session


@asynccontextmanager
async def transactional_session(
    factory: async_sessionmaker[AsyncSession] | None = None,
) -> AsyncGenerator[AsyncSession, None]:
    """Context manager for executing an atomic transaction with automatic rollback on error."""
    fac = factory or get_session_factory()
    async with fac() as session, session.begin():
        yield session


async def check_database_readiness(engine: AsyncEngine | None = None) -> bool:
    """Execute a simple query to verify database connectivity."""
    eng = engine or get_async_engine()
    try:
        async with eng.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def close_database_connections() -> None:
    """Gracefully dispose of all connection pools."""
    global _async_engine, _session_factory, _verifier_engine, _verifier_session_factory
    if _async_engine is not None:
        await _async_engine.dispose()
        _async_engine = None
        _session_factory = None
    if _verifier_engine is not None:
        await _verifier_engine.dispose()
        _verifier_engine = None
        _verifier_session_factory = None
