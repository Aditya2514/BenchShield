"""Initial B1 core tables and isolated vault schema

Revision ID: 0001_initial_b1_schemas
Revises:
Create Date: 2026-11-01 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_b1_schemas"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Ensure schemas exist
    op.execute("CREATE SCHEMA IF NOT EXISTS public")
    op.execute("CREATE SCHEMA IF NOT EXISTS vault")

    # 2. Users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="public",
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True, schema="public")

    # 3. Workspaces table
    op.create_table(
        "workspaces",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="public",
    )

    # 4. Workspace memberships
    op.create_table(
        "workspace_memberships",
        sa.Column(
            "workspace_id",
            sa.String(length=64),
            sa.ForeignKey("public.workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("public.users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("workspace_id", "user_id"),
        schema="public",
    )

    # 5. Benchmarks table
    op.create_table(
        "benchmarks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(length=64),
            sa.ForeignKey("public.workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "id", name="uq_benchmarks_ws_id"),
        schema="public",
    )

    # 6. Benchmark versions table
    op.create_table(
        "benchmark_versions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("benchmark_id", sa.String(length=64), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False, default=1),
        sa.Column("item_count", sa.Integer(), nullable=False),
        sa.Column("task_types", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id", "benchmark_id"],
            ["public.benchmarks.workspace_id", "public.benchmarks.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("workspace_id", "id", name="uq_bmv_ws_id"),
        schema="public",
    )

    # 7. Item versions table
    op.create_table(
        "item_versions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("benchmark_version_id", sa.String(length=64), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=256), nullable=False),
        sa.Column("task_type", sa.String(length=64), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("choices", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("answer_revision_id", sa.String(length=64), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id", "benchmark_version_id"],
            ["public.benchmark_versions.workspace_id", "public.benchmark_versions.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("workspace_id", "id", name="uq_itv_ws_id"),
        schema="public",
    )

    # 8. Evaluation policy versions table
    op.create_table(
        "evaluation_policy_versions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("policy_id", sa.String(length=64), nullable=False),
        sa.Column(
            "workspace_id",
            sa.String(length=64),
            sa.ForeignKey("public.workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False, default=1),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("data_classification", sa.String(length=64), nullable=False),
        sa.Column("allowed_tools", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "allowed_source_classes", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("prohibited_answer_key_access", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "benchmark_identification_permitted", sa.Boolean(), nullable=False, default=False
        ),
        sa.Column("evaluation_cutoff", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cutoff_timezone", sa.String(length=64), nullable=False, default="UTC"),
        sa.Column("item_scope", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("max_queries_per_item", sa.Integer(), nullable=False, default=3),
        sa.Column("max_fetches_per_item", sa.Integer(), nullable=False, default=5),
        sa.Column("max_concurrent_discovery_tasks", sa.Integer(), nullable=False, default=2),
        sa.Column("deadline_seconds", sa.Integer(), nullable=False, default=900),
        sa.Column("cost_ceiling_usd", sa.Float(), nullable=False, default=10.0),
        sa.Column("retention_profile", sa.String(length=64), nullable=False),
        sa.Column("reviewer_identity", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "id", name="uq_pol_ws_id"),
        schema="public",
    )

    # 9. Audit events table
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(length=64),
            sa.ForeignKey("public.workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("actor_id", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=64), nullable=False),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="public",
    )
    op.create_index(
        "ix_audit_events_correlation", "audit_events", ["correlation_id"], schema="public"
    )

    # 10. Import idempotency table
    op.create_table(
        "import_idempotency_records",
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
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("response_body", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "workspace_id", "idempotency_key", "operation", name="uq_idempotency_ws_key_op"
        ),
        schema="public",
    )

    # 11. Vault: Protected answer revisions (isolated schema)
    op.create_table(
        "protected_answers",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("benchmark_version_id", sa.String(length=64), nullable=False),
        sa.Column("item_version_id", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=256), nullable=False),
        sa.Column("encrypted_answer", sa.LargeBinary(), nullable=False),
        sa.Column("nonce", sa.LargeBinary(), nullable=False),
        sa.Column("key_version", sa.String(length=16), nullable=False, default="v1"),
        sa.Column("gold_choice_id", sa.String(length=32), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="vault",
    )
    op.create_index("ix_vault_ws_id", "protected_answers", ["workspace_id"], schema="vault")


def downgrade() -> None:
    op.drop_table("protected_answers", schema="vault")
    op.drop_table("import_idempotency_records", schema="public")
    op.drop_table("audit_events", schema="public")
    op.drop_table("evaluation_policy_versions", schema="public")
    op.drop_table("item_versions", schema="public")
    op.drop_table("benchmark_versions", schema="public")
    op.drop_table("benchmarks", schema="public")
    op.drop_table("workspace_memberships", schema="public")
    op.drop_table("workspaces", schema="public")
    op.drop_table("users", schema="public")
