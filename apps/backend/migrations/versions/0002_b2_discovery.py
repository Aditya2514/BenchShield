"""B2 investigations, discovery tasks, leases, hypotheses, budgets, sources, and events

Revision ID: 0002_b2_discovery
Revises: 0001_initial_b1_schemas
Create Date: 2026-11-01 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_b2_discovery"
down_revision: str | None = "0001_initial_b1_schemas"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Investigations table
    op.create_table(
        "investigations",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(length=64),
            sa.ForeignKey("public.workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("benchmark_version_id", sa.String(length=64), nullable=False),
        sa.Column("policy_version_id", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("substatus", sa.String(length=64), nullable=True),
        sa.Column("is_partial", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("investigated_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("strategy_version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("provider_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("budget_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "id", name="uq_investigations_ws_id"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "benchmark_version_id"],
            ["public.benchmark_versions.workspace_id", "public.benchmark_versions.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "policy_version_id"],
            [
                "public.evaluation_policy_versions.workspace_id",
                "public.evaluation_policy_versions.id",
            ],
            ondelete="RESTRICT",
        ),
        schema="public",
    )
    op.create_index(
        "ix_investigations_ws_status",
        "investigations",
        ["workspace_id", "status"],
        schema="public",
    )

    # 2. Investigation tasks table
    op.create_table(
        "investigation_tasks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("item_version_id", sa.String(length=64), nullable=False),
        sa.Column("item_index", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("current_attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("claimed_by", sa.String(length=64), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fencing_token", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "id", name="uq_inv_tasks_ws_id"),
        sa.UniqueConstraint(
            "workspace_id", "investigation_id", "item_version_id", name="uq_inv_tasks_ws_inv_item"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "investigation_id"],
            ["public.investigations.workspace_id", "public.investigations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "item_version_id"],
            ["public.item_versions.workspace_id", "public.item_versions.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )
    op.create_index(
        "ix_inv_tasks_claim",
        "investigation_tasks",
        ["workspace_id", "status", "lease_expires_at"],
        schema="public",
    )

    # 3. Investigation hypotheses
    op.create_table(
        "investigation_hypotheses",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("task_id", sa.String(length=64), nullable=False),
        sa.Column("hypothesis_type", sa.String(length=64), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("planned_queries", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="planned"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id", "task_id"],
            ["public.investigation_tasks.workspace_id", "public.investigation_tasks.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )

    # 4. Task attempts
    op.create_table(
        "task_attempts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("task_id", sa.String(length=64), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("worker_id", sa.String(length=64), nullable=False),
        sa.Column("fencing_token", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="running"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["workspace_id", "task_id"],
            ["public.investigation_tasks.workspace_id", "public.investigation_tasks.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )

    # 5. Budget reservations
    op.create_table(
        "budget_reservations",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("task_id", sa.String(length=64), nullable=True),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("reserved_amount", sa.Integer(), nullable=False),
        sa.Column("used_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="reserved"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id", "investigation_id"],
            ["public.investigations.workspace_id", "public.investigations.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )

    # 6. Search executions
    op.create_table(
        "search_executions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("task_id", sa.String(length=64), nullable=False),
        sa.Column("specialist", sa.String(length=64), nullable=False),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("result_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("results_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("cost_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id", "task_id"],
            ["public.investigation_tasks.workspace_id", "public.investigation_tasks.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )

    # 7. Candidate sources (evidence)
    op.create_table(
        "candidate_sources",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("task_id", sa.String(length=64), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("source_domain", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=True),
        sa.Column("snapshot_content", sa.Text(), nullable=True),
        sa.Column("content_sha256", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="candidate"),
        sa.Column("evidence_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id", "task_id"],
            ["public.investigation_tasks.workspace_id", "public.investigation_tasks.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )

    # 8. Operational events
    op.create_table(
        "operational_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "workspace_id", "investigation_id", "sequence_number", name="uq_op_events_seq"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "investigation_id"],
            ["public.investigations.workspace_id", "public.investigations.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )
    op.create_index(
        "ix_op_events_lookup",
        "operational_events",
        ["workspace_id", "investigation_id", "sequence_number"],
        schema="public",
    )

    # 9. Investigation Idempotency Records
    op.create_table(
        "investigation_idempotency_records",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(length=64),
            sa.ForeignKey("public.workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("operation", sa.String(length=64), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("investigation_id", sa.String(length=64), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("response_body", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "workspace_id", "idempotency_key", "operation", name="uq_inv_idempotency_ws_key_op"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "investigation_id"],
            ["public.investigations.workspace_id", "public.investigations.id"],
            ondelete="CASCADE",
        ),
        schema="public",
    )


def downgrade() -> None:
    op.drop_table("investigation_idempotency_records", schema="public")
    op.drop_table("operational_events", schema="public")
    op.drop_table("candidate_sources", schema="public")
    op.drop_table("search_executions", schema="public")
    op.drop_table("budget_reservations", schema="public")
    op.drop_table("task_attempts", schema="public")
    op.drop_table("investigation_hypotheses", schema="public")
    op.drop_table("investigation_tasks", schema="public")
    op.drop_table("investigations", schema="public")
