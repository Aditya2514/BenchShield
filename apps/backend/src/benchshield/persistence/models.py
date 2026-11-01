"""SQLAlchemy ORM models for BenchShield core persistence and isolated vault.

Architectural Guarantees:
- Schema separation: public metadata and audit events live in 'public'; protected reference answers live in 'vault'.
- Tenant boundary enforcement: composite foreign keys bind versions to their workspace at the database engine level.
- Immutability: versions are append-only.
"""

from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    LargeBinary,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class UserModel(Base):
    """User / authenticated identity."""

    __tablename__ = "users"
    __table_args__ = {"schema": "public"}

    id = Column(String(64), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class WorkspaceModel(Base):
    """Tenant workspace boundary."""

    __tablename__ = "workspaces"
    __table_args__ = {"schema": "public"}

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class WorkspaceMembershipModel(Base):
    """Association of users to workspaces with role-based permissions."""

    __tablename__ = "workspace_memberships"
    __table_args__ = (
        PrimaryKeyConstraint("workspace_id", "user_id"),
        {"schema": "public"},
    )

    workspace_id = Column(
        String(64), ForeignKey("public.workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(String(64), ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(32), nullable=False)  # viewer, operator, evaluator, admin
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class BenchmarkModel(Base):
    """Top-level benchmark record."""

    __tablename__ = "benchmarks"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id", name="uq_benchmarks_ws_id"),
        {"schema": "public"},
    )

    id = Column(String(64), primary_key=True)
    workspace_id = Column(
        String(64), ForeignKey("public.workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class BenchmarkVersionModel(Base):
    """Immutable benchmark version snapshot."""

    __tablename__ = "benchmark_versions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "benchmark_id"],
            ["public.benchmarks.workspace_id", "public.benchmarks.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("workspace_id", "id", name="uq_bmv_ws_id"),
        {"schema": "public"},
    )

    id = Column(String(64), primary_key=True)
    benchmark_id = Column(String(64), nullable=False)
    workspace_id = Column(String(64), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    item_count = Column(Integer, nullable=False)
    task_types = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class ItemVersionModel(Base):
    """Immutable public item version without gold answers."""

    __tablename__ = "item_versions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "benchmark_version_id"],
            ["public.benchmark_versions.workspace_id", "public.benchmark_versions.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("workspace_id", "id", name="uq_itv_ws_id"),
        {"schema": "public"},
    )

    id = Column(String(64), primary_key=True)
    benchmark_version_id = Column(String(64), nullable=False)
    workspace_id = Column(String(64), nullable=False)
    external_id = Column(String(256), nullable=False)
    task_type = Column(String(64), nullable=False)
    question = Column(Text, nullable=False)
    choices = Column(JSONB, nullable=True)
    answer_revision_id = Column(String(64), nullable=False)  # Links to vault.protected_answers.id
    metadata_ = Column("metadata", JSONB, nullable=False)  # Allowlisted public metadata only
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class EvaluationPolicyVersionModel(Base):
    """Immutable evaluation policy version."""

    __tablename__ = "evaluation_policy_versions"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id", name="uq_pol_ws_id"),
        {"schema": "public"},
    )

    id = Column(String(64), primary_key=True)
    policy_id = Column(String(64), nullable=False)
    workspace_id = Column(
        String(64), ForeignKey("public.workspaces.id", ondelete="CASCADE"), nullable=False
    )
    version_number = Column(Integer, nullable=False, default=1)
    name = Column(String(255), nullable=False)
    data_classification = Column(String(64), nullable=False)
    allowed_tools = Column(JSONB, nullable=False)
    allowed_source_classes = Column(JSONB, nullable=False)
    prohibited_answer_key_access = Column(Boolean, nullable=False, default=True)
    benchmark_identification_permitted = Column(Boolean, nullable=False, default=False)
    evaluation_cutoff = Column(DateTime(timezone=True), nullable=False)
    cutoff_timezone = Column(String(64), nullable=False, default="UTC")
    item_scope = Column(JSONB, nullable=True)
    max_queries_per_item = Column(Integer, nullable=False, default=3)
    max_fetches_per_item = Column(Integer, nullable=False, default=5)
    max_concurrent_discovery_tasks = Column(Integer, nullable=False, default=2)
    deadline_seconds = Column(Integer, nullable=False, default=900)
    cost_ceiling_usd = Column(Float, nullable=False, default=10.0)
    retention_profile = Column(String(64), nullable=False)
    reviewer_identity = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class AuditEventModel(Base):
    """Auditing and compliance trace of operational actions."""

    __tablename__ = "audit_events"
    __table_args__ = {"schema": "public"}

    id = Column(String(64), primary_key=True)
    workspace_id = Column(
        String(64), ForeignKey("public.workspaces.id", ondelete="CASCADE"), nullable=False
    )
    actor_id = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False)
    target_type = Column(String(64), nullable=False)
    target_id = Column(String(64), nullable=False)
    correlation_id = Column(String(64), nullable=False, index=True)
    outcome = Column(String(32), nullable=False)  # success, failure, denied
    details = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class ImportIdempotencyModel(Base):
    """Idempotency tracking record for benchmark imports."""

    __tablename__ = "import_idempotency_records"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "idempotency_key", "operation", name="uq_idempotency_ws_key_op"
        ),
        {"schema": "public"},
    )

    id = Column(String(64), primary_key=True)
    workspace_id = Column(
        String(64), ForeignKey("public.workspaces.id", ondelete="CASCADE"), nullable=False
    )
    idempotency_key = Column(String(255), nullable=False)
    operation = Column(String(64), nullable=False)
    request_hash = Column(String(64), nullable=False)
    response_status = Column(Integer, nullable=False)
    response_body = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))


class ProtectedAnswerModel(Base):
    """Restricted gold vault table in isolated 'vault' schema."""

    __tablename__ = "protected_answers"
    __table_args__ = {"schema": "vault"}

    id = Column(String(64), primary_key=True)  # answer_revision_id
    workspace_id = Column(String(64), nullable=False, index=True)
    benchmark_version_id = Column(String(64), nullable=False)
    item_version_id = Column(String(64), nullable=False)
    external_id = Column(String(256), nullable=False)
    encrypted_answer = Column(LargeBinary, nullable=False)  # AES-256-GCM ciphertext
    nonce = Column(LargeBinary, nullable=False)
    key_version = Column(String(16), nullable=False, default="v1")
    gold_choice_id = Column(String(32), nullable=True)
    content_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
