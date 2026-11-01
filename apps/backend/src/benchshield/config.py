"""Application configuration and typed settings validation.

Enforces:
- Strict validation of environment variables at startup.
- Production secret requirements (rejects missing or placeholder secrets without echoing them).
- Separation of application runtime and migration owner database credentials.
- Externalized vault encryption key for AES-256-GCM.
"""

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central typed settings for BenchShield backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_prefix="BENCHSHIELD_",
    )

    # Environment
    environment: str = Field(
        default="development",
        description="Deployment environment (development, test, staging, production)",
    )

    # Database URLs
    # Application runtime uses restricted credentials (cannot SELECT from vault)
    database_url: str = Field(
        default="postgresql+asyncpg://benchshield_app:app_dev_password@localhost:5432/benchshield",
        description="Async database connection string for runtime application",
    )
    # Migration owner credentials for Alembic migrations and database setup
    database_owner_url: str = Field(
        default="postgresql+asyncpg://benchshield_owner:owner_dev_password@localhost:5432/benchshield",
        description="Async database connection string for schema owner / migrations",
    )
    database_owner_sync_url: str = Field(
        default="postgresql://benchshield_owner:owner_dev_password@localhost:5432/benchshield",
        description="Synchronous database connection string for Alembic CLI",
    )
    # Verifier credentials for trusted grading (can SELECT from vault)
    database_verifier_url: str = Field(
        default="postgresql+asyncpg://benchshield_verifier:verifier_dev_password@localhost:5432/benchshield",
        description="Async database connection string for trusted evaluation verifier",
    )

    # Security & Vault Encryption
    # 32-byte hexadecimal string for AES-256-GCM (64 hex characters)
    vault_encryption_key: str = Field(
        default="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        description="32-byte hex key for vault encryption at rest",
    )
    vault_key_version: str = Field(
        default="v1",
        description="Key version identifier for encryption key rotation",
    )

    # Authentication & JWT
    jwt_secret: str = Field(
        default="benchshield_dev_jwt_secret_must_be_overridden_in_production_32b",
        description="Secret key for signing / verifying JWT tokens in development/test",
    )
    jwt_issuer: str = Field(
        default="benchshield-auth",
        description="Expected JWT issuer",
    )
    jwt_audience: str = Field(
        default="benchshield-api",
        description="Expected JWT audience",
    )
    jwt_algorithm: str = Field(
        default="HS256",
        description="JWT signature algorithm",
    )

    # Development Shortcuts (MUST be False in production)
    allow_insecure_auth_shortcuts: bool = Field(
        default=False,
        description="Allows test headers for actor identity (STRICTLY FORBIDDEN in production)",
    )

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        valid_envs = {"development", "test", "staging", "production"}
        clean = v.strip().lower()
        if clean not in valid_envs:
            raise ValueError(f"Invalid environment '{v}'. Must be one of: {sorted(valid_envs)}")
        return clean

    @field_validator("vault_encryption_key")
    @classmethod
    def validate_vault_key(cls, v: str) -> str:
        clean = v.strip()
        try:
            raw_bytes = bytes.fromhex(clean)
            if len(raw_bytes) != 32:
                raise ValueError(
                    "Vault encryption key must be exactly 32 bytes (64 hex characters)."
                )
        except ValueError as err:
            raise ValueError(
                "Invalid vault encryption key: must be a 64-character hexadecimal string."
            ) from err
        return clean

    def check_production_constraints(self) -> None:
        """Validate that insecure defaults or development shortcuts are never used in production."""
        if self.environment in ("production", "staging"):
            if self.allow_insecure_auth_shortcuts:
                raise ValueError(
                    "SECURITY VIOLATION: Insecure auth shortcuts cannot be enabled in production."
                )
            if "dev" in self.vault_encryption_key.lower() or self.vault_encryption_key == (
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
            ):
                raise ValueError(
                    "SECURITY VIOLATION: Default vault encryption key must be replaced in production."
                )
            if "dev" in self.jwt_secret.lower():
                raise ValueError(
                    "SECURITY VIOLATION: Default JWT secret must be replaced in production."
                )


# Cached settings instance
_global_settings: Settings | None = None


def get_settings() -> Settings:
    """Retrieve global cached settings instance."""
    global _global_settings
    if _global_settings is None:
        _global_settings = Settings()
        _global_settings.check_production_constraints()
    return _global_settings


def set_settings(settings: Settings | None = None) -> None:
    """Explicitly set or reset the global cached settings instance (used for testing)."""
    global _global_settings
    _global_settings = settings
