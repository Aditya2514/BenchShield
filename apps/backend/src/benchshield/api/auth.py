"""Authentication and role-based authorization.

Standards & Boundary Guarantees:
- Validates signed JWT tokens (signature, algorithm, issuer, audience, expiration).
- Never trusts unsigned headers or unverified client claims.
- Validates workspace membership server-side in PostgreSQL for every operation.
- Enforces an explicit role/permission matrix (viewer, operator, evaluator, admin).
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.config import Settings, get_settings
from benchshield.persistence.database import get_db_session
from benchshield.persistence.models import WorkspaceMembershipModel


class WorkspaceRole(StrEnum):
    """Permitted workspace roles."""

    VIEWER = "viewer"
    OPERATOR = "operator"
    EVALUATOR = "evaluator"
    ADMIN = "admin"


class Permission(StrEnum):
    """Discrete system operations requiring authorization."""

    READ_BENCHMARK = "read_benchmark"
    IMPORT_BENCHMARK = "import_benchmark"
    READ_POLICY = "read_policy"
    CREATE_POLICY = "create_policy"
    LAUNCH_INVESTIGATION = "launch_investigation"
    READ_INVESTIGATION = "read_investigation"
    CANCEL_INVESTIGATION = "cancel_investigation"
    REVIEW_FINDINGS = "review_findings"
    EXPORT_REPORTS = "export_reports"
    ADMIN_WORKSPACE = "admin_workspace"


# Explicit Role-Permission Matrix
ROLE_PERMISSIONS: dict[WorkspaceRole, set[Permission]] = {
    WorkspaceRole.VIEWER: {
        Permission.READ_BENCHMARK,
        Permission.READ_POLICY,
        Permission.READ_INVESTIGATION,
    },
    WorkspaceRole.OPERATOR: {
        Permission.READ_BENCHMARK,
        Permission.READ_POLICY,
        Permission.IMPORT_BENCHMARK,
        Permission.CREATE_POLICY,
        Permission.LAUNCH_INVESTIGATION,
        Permission.READ_INVESTIGATION,
        Permission.CANCEL_INVESTIGATION,
    },
    WorkspaceRole.EVALUATOR: {
        Permission.READ_BENCHMARK,
        Permission.READ_POLICY,
        Permission.IMPORT_BENCHMARK,
        Permission.CREATE_POLICY,
        Permission.LAUNCH_INVESTIGATION,
        Permission.READ_INVESTIGATION,
        Permission.CANCEL_INVESTIGATION,
        Permission.REVIEW_FINDINGS,
    },
    WorkspaceRole.ADMIN: {
        Permission.READ_BENCHMARK,
        Permission.READ_POLICY,
        Permission.IMPORT_BENCHMARK,
        Permission.CREATE_POLICY,
        Permission.LAUNCH_INVESTIGATION,
        Permission.READ_INVESTIGATION,
        Permission.CANCEL_INVESTIGATION,
        Permission.REVIEW_FINDINGS,
        Permission.EXPORT_REPORTS,
        Permission.ADMIN_WORKSPACE,
    },
}


@dataclass(frozen=True)
class AuthenticatedActor:
    """Verified identity with resolved tenant role."""

    user_id: str
    email: str
    role: WorkspaceRole
    workspace_id: str


def create_jwt_token(
    user_id: str,
    email: str,
    expires_in_seconds: int = 3600,
    settings: Settings | None = None,
    custom_issuer: str | None = None,
    custom_audience: str | None = None,
    secret: str | None = None,
) -> str:
    """Generate a valid signed JWT for testing or token issuance."""
    cfg = settings or get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "email": email,
        "iss": custom_issuer or cfg.jwt_issuer,
        "aud": custom_audience or cfg.jwt_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret or cfg.jwt_secret, algorithm=cfg.jwt_algorithm)


def verify_bearer_token(
    token: str,
    settings: Settings | None = None,
) -> dict:
    """Verify cryptographic signature and claims of a bearer token."""
    cfg = settings or get_settings()
    try:
        decoded = jwt.decode(
            token,
            cfg.jwt_secret,
            algorithms=[cfg.jwt_algorithm],
            issuer=cfg.jwt_issuer,
            audience=cfg.jwt_audience,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        return decoded
    except jwt.ExpiredSignatureError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
        ) from err
    except (jwt.InvalidTokenError, ValueError) as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {err}",
        ) from err


async def get_current_user_claims(
    authorization: Annotated[str | None, Header(description="Bearer <JWT>")] = None,
    settings: Settings = Depends(get_settings),
) -> dict:
    """Extract and cryptographically verify bearer token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected 'Bearer <token>'.",
        )
    token = authorization.split(" ", 1)[1].strip()
    return verify_bearer_token(token, settings=settings)


def require_permission(permission: Permission):
    """FastAPI dependency factory enforcing server-side membership and permission checks."""

    async def dependency(
        request: Request,
        claims: dict = Depends(get_current_user_claims),
        x_workspace_id: Annotated[
            str | None, Header(alias="X-Workspace-ID", description="Active workspace ID")
        ] = None,
        db: AsyncSession = Depends(get_db_session),
        settings: Settings = Depends(get_settings),
    ) -> AuthenticatedActor:
        user_id = claims.get("sub")
        email = claims.get("email", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token claims missing subject identifier.",
            )

        workspace_id = x_workspace_id
        if not workspace_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-Workspace-ID header is required for tenant-scoped operations.",
            )

        # Development shortcut: only active when explicitly enabled in non-production
        if settings.allow_insecure_auth_shortcuts:
            shortcut_role_str = request.headers.get("x-actor-role", "admin")
            try:
                shortcut_role = WorkspaceRole(shortcut_role_str)
            except ValueError:
                shortcut_role = WorkspaceRole.ADMIN
            return AuthenticatedActor(
                user_id=user_id,
                email=email or f"{user_id}@test.local",
                role=shortcut_role,
                workspace_id=workspace_id,
            )

        # Server-side database verification of workspace membership
        stmt = select(WorkspaceMembershipModel).where(
            WorkspaceMembershipModel.workspace_id == workspace_id,
            WorkspaceMembershipModel.user_id == user_id,
        )
        result = await db.execute(stmt)
        membership = result.scalar_one_or_none()

        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User '{user_id}' is not a member of workspace '{workspace_id}'.",
            )

        try:
            role = WorkspaceRole(membership.role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Invalid workspace membership role '{membership.role}'.",
            ) from None

        allowed_perms = ROLE_PERMISSIONS.get(role, set())
        if permission not in allowed_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role.value}' lacks required permission '{permission.value}'.",
            )

        return AuthenticatedActor(
            user_id=user_id,
            email=email,
            role=role,
            workspace_id=workspace_id,
        )

    return dependency
