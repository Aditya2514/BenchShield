"""B4 controlled attacker experiments and adversarial runs

Revision ID: 0004_b4_experiments
Revises: 0003_b3_findings
Create Date: 2026-11-01 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_b4_experiments"
down_revision: str | None = "0003_b3_findings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONB = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    op.create_table(
        "experiments",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("benchmark_version_id", sa.String(length=64), nullable=False),
        sa.Column("policy_version_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="running"),
        sa.Column("config", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "id", name="uq_experiments_ws_id"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "investigation_id"],
            ["public.investigations.workspace_id", "public.investigations.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )
    op.create_index(
        "ix_experiments_investigation", "experiments", ["investigation_id"], schema="public"
    )

    op.create_table(
        "adversarial_runs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("experiment_id", sa.String(length=64), nullable=False),
        sa.Column("item_version_id", sa.String(length=64), nullable=False),
        sa.Column("condition", sa.String(length=32), nullable=False),
        sa.Column("run_status", sa.String(length=32), nullable=False),
        sa.Column(
            "source_discovered", sa.String(length=16), nullable=False, server_default="unknown"
        ),
        sa.Column(
            "answer_bearing_content_retrieved",
            sa.String(length=16),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column(
            "grader_outcome", sa.String(length=32), nullable=False, server_default="unsupported"
        ),
        sa.Column("attribution", sa.String(length=32), nullable=False, server_default="none"),
        sa.Column(
            "policy_compliance", sa.String(length=32), nullable=False, server_default="unknown"
        ),
        sa.Column("observable_tool_calls", JSONB, nullable=False),
        sa.Column("generated_output", sa.Text(), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("cost_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "id", name="uq_adversarial_runs_ws_id"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "experiment_id"],
            ["public.experiments.workspace_id", "public.experiments.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )
    op.create_index(
        "ix_adversarial_runs_experiment", "adversarial_runs", ["experiment_id"], schema="public"
    )


def downgrade() -> None:
    op.drop_index("ix_adversarial_runs_experiment", table_name="adversarial_runs", schema="public")
    op.drop_table("adversarial_runs", schema="public")
    op.drop_index("ix_experiments_investigation", table_name="experiments", schema="public")
    op.drop_table("experiments", schema="public")
