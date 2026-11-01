"""B3 verified findings, append-only review decisions, and frozen reports

Revision ID: 0003_b3_findings
Revises: 0002_b2_discovery
Create Date: 2026-11-01 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_b3_findings"
down_revision: str | None = "0002_b2_discovery"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONB = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    op.create_table(
        "findings",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("candidate_source_id", sa.String(length=64), nullable=False),
        sa.Column("item_version_id", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=256), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("exposure_type", sa.String(length=32), nullable=False),
        sa.Column("claim_status", sa.String(length=32), nullable=False),
        sa.Column("task_identity", sa.String(length=32), nullable=False),
        sa.Column("answer_match", sa.String(length=32), nullable=False),
        sa.Column("temporal_status", sa.String(length=48), nullable=False),
        sa.Column("auto_claim_status", sa.String(length=32), nullable=False),
        sa.Column("claim", JSONB, nullable=False),
        sa.Column("verification", JSONB, nullable=False),
        sa.Column("temporal", JSONB, nullable=False),
        sa.Column("snapshot", JSONB, nullable=False),
        sa.Column("current_reviewer_decision", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "id", name="uq_findings_ws_id"),
        sa.UniqueConstraint(
            "workspace_id", "candidate_source_id", name="uq_findings_ws_candidate"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "investigation_id"],
            ["public.investigations.workspace_id", "public.investigations.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )
    op.create_index("ix_findings_investigation", "findings", ["investigation_id"], schema="public")

    op.create_table(
        "review_decisions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("finding_id", sa.String(length=64), nullable=False),
        sa.Column("expected_version", sa.Integer(), nullable=False),
        sa.Column("new_version", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("finding_id", "new_version", name="uq_review_finding_version"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "finding_id"],
            ["public.findings.workspace_id", "public.findings.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("report_version", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("actor_id", sa.String(length=64), nullable=False),
        sa.Column("content", JSONB, nullable=True),
        sa.Column("content_sha256", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "workspace_id", "investigation_id", "report_version", name="uq_reports_inv_version"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "investigation_id"],
            ["public.investigations.workspace_id", "public.investigations.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )

    # Review decisions are append-only for the runtime role.
    op.execute("REVOKE UPDATE, DELETE ON public.review_decisions FROM benchshield_app")


def downgrade() -> None:
    op.drop_table("reports", schema="public")
    op.drop_table("review_decisions", schema="public")
    op.drop_index("ix_findings_investigation", table_name="findings", schema="public")
    op.drop_table("findings", schema="public")
