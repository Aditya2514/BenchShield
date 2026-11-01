"""Reproducible local development and integration test bootstrap procedure.

Seeds two isolated test identities in two distinct workspaces:
- User A: Alice (admin of Workspace Alpha)
- User B: Bob (admin of Workspace Beta)

Does NOT seed insecure production credentials. Strictly for local development and test environments.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.api.auth import WorkspaceRole
from benchshield.persistence.models import UserModel, WorkspaceMembershipModel, WorkspaceModel

BOOTSTRAP_USER_A = {
    "id": "usr_alice",
    "email": "alice@corp-alpha.com",
    "full_name": "Alice Auditor",
}

BOOTSTRAP_USER_B = {
    "id": "usr_bob",
    "email": "bob@corp-beta.com",
    "full_name": "Bob Benchmark",
}

BOOTSTRAP_WORKSPACE_A = {
    "id": "ws_alpha",
    "name": "Alpha Research Labs",
}

BOOTSTRAP_WORKSPACE_B = {
    "id": "ws_beta",
    "name": "Beta AI Systems",
}


async def bootstrap_development_identities(session: AsyncSession) -> dict[str, str]:
    """Seed test users, workspaces, and memberships idempotently."""
    # 1. Users
    for u in (BOOTSTRAP_USER_A, BOOTSTRAP_USER_B):
        stmt = select(UserModel).where(UserModel.id == u["id"])
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing is None:
            user = UserModel(
                id=u["id"],
                email=u["email"],
                full_name=u["full_name"],
                created_at=datetime.now(UTC),
            )
            session.add(user)

    # 2. Workspaces
    for w in (BOOTSTRAP_WORKSPACE_A, BOOTSTRAP_WORKSPACE_B):
        stmt = select(WorkspaceModel).where(WorkspaceModel.id == w["id"])
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing is None:
            workspace = WorkspaceModel(
                id=w["id"],
                name=w["name"],
                created_at=datetime.now(UTC),
            )
            session.add(workspace)

    await session.flush()

    # 3. Memberships
    memberships = [
        ("ws_alpha", "usr_alice", WorkspaceRole.ADMIN.value),
        ("ws_beta", "usr_bob", WorkspaceRole.ADMIN.value),
    ]

    for ws_id, u_id, role in memberships:
        stmt = select(WorkspaceMembershipModel).where(
            WorkspaceMembershipModel.workspace_id == ws_id,
            WorkspaceMembershipModel.user_id == u_id,
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing is None:
            membership = WorkspaceMembershipModel(
                workspace_id=ws_id,
                user_id=u_id,
                role=role,
                created_at=datetime.now(UTC),
            )
            session.add(membership)

    await session.commit()
    return {
        "user_a_id": "usr_alice",
        "user_b_id": "usr_bob",
        "workspace_a_id": "ws_alpha",
        "workspace_b_id": "ws_beta",
    }


if __name__ == "__main__":
    import asyncio

    from benchshield.persistence.database import get_session_factory

    async def main():
        factory = get_session_factory()
        async with factory() as session:
            res = await bootstrap_development_identities(session)
            print("Successfully bootstrapped identities:", res)

    asyncio.run(main())
