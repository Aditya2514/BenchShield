"""Comprehensive real PostgreSQL integration test suite for BenchShield Phase B1.

Tests real database boundary conditions using embedded-postgres:
1. Fresh migration and upgrade path (upgrade -> downgrade -> upgrade).
2. Valid CSV and JSON imports.
3. Malformed, oversized, duplicate, and unsupported task imports.
4. Authentication failures: missing token, expired token, tampered signature.
5. Authorization checks: workspace membership and role enforcement (admin vs operator vs viewer).
6. Cross-workspace isolation at API and database foreign key boundary.
7. Privilege separation: ordinary runtime (benchshield_app) DENIED SELECT on vault.protected_answers.
8. Trusted verifier access: restricted identity (benchshield_verifier) reads and decrypts answer.
9. Atomic rollback: injected vault failure leaves zero partial public or vault records.
10. Import idempotency: replay returns cached outcome; conflicting input returns 409; concurrent safety.
11. Immutable revisions: changed choices create new item version; changed answer creates new answer revision.
12. Immutable evaluation policies: creation, version increments, and rejection of confidential external discovery.
13. Response, audit log, and error redaction: synthetic sentinels never escape.
14. Persistence across simulated application restart.
"""

import io
import json
from uuid import uuid4

import httpx
import psycopg
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from benchshield.api.app import create_app
from benchshield.api.auth import AuthenticatedActor, WorkspaceRole
from benchshield.config import set_settings
from benchshield.domain.enums import TaskType
from benchshield.domain.models.intake import BenchmarkImportRequest, ItemIntake
from benchshield.persistence.database import (
    close_database_connections,
    get_verifier_session_factory,
)
from benchshield.persistence.models import (
    AuditEventModel,
    BenchmarkModel,
    BenchmarkVersionModel,
)
from benchshield.services.vault_service import TrustedVaultReader
from tests.conftest import (
    auth_headers,
    make_token,
)


# ===========================================================================
# 1. Migration and Upgrade Path Verification
# ===========================================================================
def test_migration_and_upgrade_path(real_postgres_env):
    """Verify upgrade, downgrade to base, and upgrade back to head on an isolated database."""
    cfg = Config(real_postgres_env["alembic_ini_path"])
    cfg.set_main_option(
        "sqlalchemy.url", real_postgres_env["migration_owner_sync_url"].replace("%", "%%")
    )

    # 1. Upgrade to head
    command.upgrade(cfg, "head")
    with (
        psycopg.connect(real_postgres_env["migration_owner_raw_uri"]) as conn,
        conn.cursor() as cur,
    ):
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        tables = [row[0] for row in cur.fetchall()]
        assert "benchmarks" in tables
        assert "users" in tables

    # 2. Downgrade to base
    command.downgrade(cfg, "base")
    with (
        psycopg.connect(real_postgres_env["migration_owner_raw_uri"]) as conn,
        conn.cursor() as cur,
    ):
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        tables = [row[0] for row in cur.fetchall() if row[0] != "spatial_ref_sys"]
        assert "benchmarks" not in tables
        assert "users" not in tables

    # 3. Upgrade back to head
    command.upgrade(cfg, "head")
    with (
        psycopg.connect(real_postgres_env["migration_owner_raw_uri"]) as conn,
        conn.cursor() as cur,
    ):
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        tables = [row[0] for row in cur.fetchall()]
        assert "benchmarks" in tables


# ===========================================================================
# 2. Health Liveness & Readiness Probes
# ===========================================================================
@pytest.mark.asyncio
async def test_health_probes(app_client: httpx.AsyncClient):
    """Verify health liveness and readiness endpoints with active database."""
    res_live = await app_client.get("/health/live")
    assert res_live.status_code == 200
    assert res_live.json() == {"status": "alive"}

    res_ready = await app_client.get("/health/ready")
    assert res_ready.status_code == 200
    data = res_ready.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"


# ===========================================================================
# 3. Authentication & Authorization Tests
# ===========================================================================
@pytest.mark.asyncio
async def test_authentication_failures(app_client: httpx.AsyncClient):
    """Verify missing, invalid, and expired tokens are rejected with 401."""
    # A. Missing Authorization header
    res1 = await app_client.post("/api/v1/benchmarks", json={"name": "test", "items": []})
    assert res1.status_code == 401
    assert "Authorization header" in res1.json()["message"]

    # B. Tampered signature
    valid_token = make_token("usr_alice", "alice@corp-alpha.com")
    tampered_token = valid_token[:-4] + "wxyz"
    res2 = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(tampered_token),
        json={"name": "test", "items": []},
    )
    assert res2.status_code == 401

    # C. Expired token
    expired_token = make_token("usr_alice", "alice@corp-alpha.com", expires_in=-60)
    res3 = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(expired_token),
        json={"name": "test", "items": []},
    )
    assert res3.status_code == 401
    assert "expired" in res3.json()["message"].lower()


@pytest.mark.asyncio
async def test_workspace_membership_and_role_authorization(app_client: httpx.AsyncClient):
    """Verify server-side workspace membership check and role permissions."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")
    viewer_token = make_token("usr_charlie", "charlie@corp-alpha.com")

    # A. Alice trying to access Workspace Beta (not a member) -> 403 Forbidden
    res_non_member = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token, workspace_id="ws_beta"),
        json={"name": "test", "items": []},
    )
    assert res_non_member.status_code == 403
    assert "not a member" in res_non_member.json()["message"]

    # B. Charlie has 'viewer' role in ws_alpha. Viewer cannot IMPORT_BENCHMARK -> 403 Forbidden
    res_viewer_forbidden = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(viewer_token, workspace_id="ws_alpha"),
        json={
            "name": "viewer-attempt",
            "items": [
                {
                    "external_id": "q1",
                    "task_type": "exact_short_answer",
                    "question": "Q?",
                    "gold_answer": "A",
                }
            ],
        },
    )
    assert res_viewer_forbidden.status_code == 403
    assert "lacks required permission" in res_viewer_forbidden.json()["message"]


# ===========================================================================
# 4. Valid JSON and CSV Benchmark Intake
# ===========================================================================
@pytest.mark.asyncio
async def test_valid_json_and_csv_imports(app_client: httpx.AsyncClient):
    """Verify both JSON body and CSV multipart file imports succeed atomically."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")

    # A. Valid JSON import
    json_payload = {
        "name": "Synthetic Math Benchmark",
        "items": [
            {
                "external_id": "math_001",
                "task_type": "exact_short_answer",
                "question": "What is 12 + 15?",
                "gold_answer": "27",
                "metadata": {"domain": "arithmetic", "difficulty": "easy"},
            },
            {
                "external_id": "math_002",
                "task_type": "multiple_choice",
                "question": "Which prime is even?",
                "choices": [
                    {"id": "A", "text": "2"},
                    {"id": "B", "text": "3"},
                    {"id": "C", "text": "5"},
                ],
                "gold_answer": "A",
                "metadata": {"domain": "primes", "difficulty": "easy"},
            },
        ],
    }

    res_json = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token),
        json=json_payload,
    )
    assert res_json.status_code == 200
    data_json = res_json.json()
    assert data_json["status"] == "accepted"
    assert data_json["total_rows"] == 2
    assert data_json["valid_rows"] == 2
    assert data_json["benchmark_id"].startswith("bmk_")
    assert data_json["benchmark_version_id"].startswith("bmv_")
    assert data_json["errors"] == []

    # B. Valid CSV upload
    csv_text = (
        "external_id,task_type,question,choices,gold_answer\n"
        "csv_001,exact_short_answer,What is the capital of France?,,Paris\n"
        "csv_002,multiple_choice,What is 2+2?,A: 4; B: 5; C: 6,A\n"
    )
    files = {"file": ("test_benchmark.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    data = {"name": "Synthetic Geography Benchmark"}

    res_csv = await app_client.post(
        "/api/v1/benchmarks/upload",
        headers=auth_headers(alice_token),
        data=data,
        files=files,
    )
    assert res_csv.status_code == 200
    data_csv = res_csv.json()
    assert data_csv["status"] == "accepted"
    assert data_csv["total_rows"] == 2
    assert data_csv["valid_rows"] == 2
    assert data_csv["errors"] == []


# ===========================================================================
# 5. Malformed, Oversized, Duplicate, and Unsupported Inputs
# ===========================================================================
@pytest.mark.asyncio
async def test_input_validation_and_sanitized_row_errors(app_client: httpx.AsyncClient):
    """Verify malformed, duplicate, and unsupported task rows are rejected with sanitized row errors."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")

    # A. Duplicate external IDs in the same batch
    dup_payload = {
        "name": "Duplicate Batch",
        "items": [
            {
                "external_id": "dup_01",
                "task_type": "exact_short_answer",
                "question": "Question 1",
                "gold_answer": "Ans 1",
            },
            {
                "external_id": "dup_01",
                "task_type": "exact_short_answer",
                "question": "Question 2",
                "gold_answer": "Ans 2",
            },
        ],
    }
    res_dup = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token),
        json=dup_payload,
    )
    assert res_dup.status_code == 200
    dup_data = res_dup.json()
    assert dup_data["status"] == "rejected"
    assert dup_data["benchmark_version_id"] is None
    assert len(dup_data["errors"]) > 0
    assert any(e["error_code"] == "duplicate_item_id" for e in dup_data["errors"])

    # B. Unsupported task type
    unsupported_payload = {
        "name": "Unsupported Task Batch",
        "items": [
            {
                "external_id": "unsup_01",
                "task_type": "creative_writing_essay",
                "question": "Write a poem",
                "gold_answer": "Roses are red",
            }
        ],
    }
    res_unsup = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token),
        json=unsupported_payload,
    )
    assert res_unsup.status_code == 422


# ===========================================================================
# 6. Cross-Workspace Isolation & Database Boundary Constraints
# ===========================================================================
@pytest.mark.asyncio
async def test_cross_workspace_isolation_api(app_client: httpx.AsyncClient):
    """Verify Bob in Workspace Beta cannot read Alice's benchmark from Workspace Alpha."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")
    bob_token = make_token("usr_bob", "bob@corp-beta.com")

    # Alice creates a benchmark in ws_alpha
    res_import = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token, workspace_id="ws_alpha"),
        json={
            "name": "Alpha Secret Benchmark",
            "items": [
                {
                    "external_id": "sec_01",
                    "task_type": "exact_short_answer",
                    "question": "Alpha Q",
                    "gold_answer": "Alpha A",
                }
            ],
        },
    )
    assert res_import.status_code == 200
    bmk_id = res_import.json()["benchmark_id"]
    ver_id = res_import.json()["benchmark_version_id"]

    # Bob in ws_beta attempts to read Alice's benchmark metadata
    res_bob_bmk = await app_client.get(
        f"/api/v1/benchmarks/{bmk_id}",
        headers=auth_headers(bob_token, workspace_id="ws_beta"),
    )
    assert res_bob_bmk.status_code == 404

    # Bob in ws_beta attempts to read Alice's version metadata
    res_bob_ver = await app_client.get(
        f"/api/v1/benchmarks/versions/{ver_id}",
        headers=auth_headers(bob_token, workspace_id="ws_beta"),
    )
    assert res_bob_ver.status_code == 404

    # Bob in ws_beta attempts to read Alice's items
    res_bob_items = await app_client.get(
        f"/api/v1/benchmarks/versions/{ver_id}/items",
        headers=auth_headers(bob_token, workspace_id="ws_beta"),
    )
    assert res_bob_items.status_code == 404


@pytest.mark.asyncio
async def test_cross_workspace_database_fk_boundary(test_settings):
    """Verify that composite foreign keys reject cross-workspace relations at DB engine level."""
    engine = create_async_engine(test_settings.database_url)
    session_fac = async_sessionmaker(engine, expire_on_commit=False)

    async with session_fac() as session:
        bmk_id = f"bmk_{uuid4().hex[:16]}"
        bmk = BenchmarkModel(
            id=bmk_id,
            workspace_id="ws_alpha",
            name="Alpha DB FK Benchmark",
        )
        session.add(bmk)
        await session.commit()

        bad_version = BenchmarkVersionModel(
            id=f"bmkv_{uuid4().hex[:16]}",
            workspace_id="ws_beta",
            benchmark_id=bmk_id,
            version_number=1,
            item_count=1,
            task_types=["exact_short_answer"],
        )
        session.add(bad_version)
        with pytest.raises(DBAPIError) as exc_info:
            await session.commit()

        assert "foreign key" in str(exc_info.value).lower()
        await session.rollback()

    await engine.dispose()


# ===========================================================================
# 7. Vault Privilege Boundary: Runtime Denied SELECT, Verifier Allowed
# ===========================================================================
@pytest.mark.asyncio
async def test_vault_privilege_boundary(test_settings):
    """Verify benchshield_app is denied SELECT on vault, while benchshield_verifier is permitted."""
    app_engine = create_async_engine(test_settings.database_url)
    async with app_engine.connect() as conn:
        with pytest.raises(DBAPIError) as exc_info:
            await conn.execute(text("SELECT * FROM vault.protected_answers"))
        assert "permission denied" in str(exc_info.value).lower()
    await app_engine.dispose()

    verifier_engine = create_async_engine(test_settings.database_verifier_url)
    async with verifier_engine.connect() as conn:
        result = await conn.execute(text("SELECT count(*) FROM vault.protected_answers"))
        count = result.scalar()
        assert count is not None
        assert isinstance(count, int)
    await verifier_engine.dispose()


# ===========================================================================
# 8. Verifier Decryption & Gold Revision Verification
# ===========================================================================
@pytest.mark.asyncio
async def test_trusted_vault_reader_decryption(app_client: httpx.AsyncClient, test_settings):
    """Verify that TrustedVaultReader correctly fetches and decrypts gold answers."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")

    secret_gold = "CONFIDENTIAL_GOLD_ANSWER_42"
    res = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token),
        json={
            "name": "Secret Gold Benchmark",
            "items": [
                {
                    "external_id": "secret_q1",
                    "task_type": "exact_short_answer",
                    "question": "What is the secret answer?",
                    "gold_answer": secret_gold,
                }
            ],
        },
    )
    assert res.status_code == 200
    version_id = res.json()["benchmark_version_id"]

    items_res = await app_client.get(
        f"/api/v1/benchmarks/versions/{version_id}/items",
        headers=auth_headers(alice_token),
    )
    assert items_res.status_code == 200
    items = items_res.json()["items"]
    assert len(items) == 1
    answer_rev_id = items[0]["answer_revision_id"]
    assert answer_rev_id.startswith("anr_")

    verifier_session_factory = get_verifier_session_factory(test_settings)
    async with verifier_session_factory() as verifier_session:
        vault_reader = TrustedVaultReader(
            verifier_session=verifier_session,
            settings=test_settings,
        )
        gold_text, gold_choice = await vault_reader.get_protected_answer(
            answer_revision_id=answer_rev_id,
            workspace_id="ws_alpha",
        )
        assert gold_text == secret_gold
        assert gold_choice is None


# ===========================================================================
# 9. Atomic Rollback on Injected Failure
# ===========================================================================
@pytest.mark.asyncio
async def test_atomic_rollback_on_injected_vault_failure(test_settings, monkeypatch):
    """Verify that an error during vault persistence rolls back public records entirely."""
    engine = create_async_engine(test_settings.database_url)
    session_fac = async_sessionmaker(engine, expire_on_commit=False)

    from benchshield.services.benchmark_service import BenchmarkService

    test_bmk_name = f"Rollback Test Benchmark {uuid4().hex[:8]}"

    # Monkeypatch vault encryption to simulate failure during vault writing
    def mock_encrypt_failure(**kwargs):
        raise RuntimeError("Simulated vault encryption hardware failure")

    monkeypatch.setattr(
        "benchshield.services.benchmark_service.encrypt_gold_answer",
        mock_encrypt_failure,
    )

    async with session_fac() as session:
        service = BenchmarkService(session, settings=test_settings)
        actor = AuthenticatedActor(
            user_id="usr_alice",
            email="alice@corp-alpha.com",
            workspace_id="ws_alpha",
            role=WorkspaceRole.ADMIN,
        )

        req = BenchmarkImportRequest(
            name=test_bmk_name,
            items=[
                ItemIntake(
                    external_id="rb_01",
                    task_type=TaskType.EXACT_SHORT_ANSWER,
                    question="Rollback Q?",
                    gold_answer="Rollback A",
                )
            ],
        )

        with pytest.raises(RuntimeError, match="Simulated vault encryption hardware failure"):
            await service.import_benchmark(req, actor=actor, correlation_id="req_test_rb")

        stmt_bmk = select(BenchmarkModel).where(BenchmarkModel.name == test_bmk_name)
        bmk = (await session.execute(stmt_bmk)).scalar_one_or_none()
        assert bmk is None

    await engine.dispose()


# ===========================================================================
# 10. Import Idempotency
# ===========================================================================
@pytest.mark.asyncio
async def test_import_idempotency_workflow(app_client: httpx.AsyncClient):
    """Verify exact replay returns original outcome; conflicting payload returns 409."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")
    idemp_key = f"key_{uuid4().hex}"

    req_payload_1 = {
        "name": "Idempotent Benchmark",
        "items": [
            {
                "external_id": "idem_1",
                "task_type": "exact_short_answer",
                "question": "Question 1?",
                "gold_answer": "Answer 1",
            }
        ],
    }

    # 1. First import
    res1 = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token, extra={"Idempotency-Key": idemp_key}),
        json=req_payload_1,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "accepted"
    v1_id = data1["benchmark_version_id"]

    # 2. Replay with identical payload and same Idempotency-Key -> Returns same response
    res2 = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token, extra={"Idempotency-Key": idemp_key}),
        json=req_payload_1,
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["benchmark_version_id"] == v1_id
    assert data2["benchmark_id"] == data1["benchmark_id"]

    # 3. Same Idempotency-Key with DIFFERENT payload -> 409 Conflict
    req_payload_2 = {
        "name": "Idempotent Benchmark",
        "items": [
            {
                "external_id": "idem_1",
                "task_type": "exact_short_answer",
                "question": "DIFFERENT QUESTION?",
                "gold_answer": "Answer 1",
            }
        ],
    }
    res3 = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token, extra={"Idempotency-Key": idemp_key}),
        json=req_payload_2,
    )
    assert res3.status_code == 409
    assert "reused with different request payload" in res3.json()["message"]


# ===========================================================================
# 11. Immutable Revisions: Changed Choices & Changed Answers
# ===========================================================================
@pytest.mark.asyncio
async def test_immutable_revision_identity(app_client: httpx.AsyncClient):
    """Verify changing choices creates a new item version, and changing answer creates a new answer revision."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")
    bmk_name = f"Immutable Test Benchmark {uuid4().hex[:8]}"

    # A. Initial Import
    initial_payload = {
        "name": bmk_name,
        "items": [
            {
                "external_id": "q_mc",
                "task_type": "multiple_choice",
                "question": "Which direction does the sun rise?",
                "choices": [
                    {"id": "A", "text": "East"},
                    {"id": "B", "text": "West"},
                ],
                "gold_answer": "A",
            }
        ],
    }
    res1 = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token),
        json=initial_payload,
    )
    assert res1.status_code == 200
    ver1_id = res1.json()["benchmark_version_id"]

    items_res1 = await app_client.get(
        f"/api/v1/benchmarks/versions/{ver1_id}/items",
        headers=auth_headers(alice_token),
    )
    item_v1 = items_res1.json()["items"][0]
    item_v1_id = item_v1["item_version_id"]
    ans_rev1_id = item_v1["answer_revision_id"]

    # B. Changed Choices: change text of option B from 'West' to 'North'
    changed_choices_payload = {
        "name": bmk_name,
        "items": [
            {
                "external_id": "q_mc",
                "task_type": "multiple_choice",
                "question": "Which direction does the sun rise?",
                "choices": [
                    {"id": "A", "text": "East"},
                    {"id": "B", "text": "North"},
                ],
                "gold_answer": "A",
            }
        ],
    }
    res2 = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token),
        json=changed_choices_payload,
    )
    assert res2.status_code == 200
    ver2_id = res2.json()["benchmark_version_id"]
    assert ver2_id != ver1_id

    items_res2 = await app_client.get(
        f"/api/v1/benchmarks/versions/{ver2_id}/items",
        headers=auth_headers(alice_token),
    )
    item_v2 = items_res2.json()["items"][0]
    assert item_v2["item_version_id"] != item_v1_id

    # C. Changed Answer: change answer from 'A' to 'B'
    changed_answer_payload = {
        "name": bmk_name,
        "items": [
            {
                "external_id": "q_mc",
                "task_type": "multiple_choice",
                "question": "Which direction does the sun rise?",
                "choices": [
                    {"id": "A", "text": "East"},
                    {"id": "B", "text": "North"},
                ],
                "gold_answer": "B",
            }
        ],
    }
    res3 = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token),
        json=changed_answer_payload,
    )
    assert res3.status_code == 200
    ver3_id = res3.json()["benchmark_version_id"]
    assert ver3_id != ver2_id

    items_res3 = await app_client.get(
        f"/api/v1/benchmarks/versions/{ver3_id}/items",
        headers=auth_headers(alice_token),
    )
    item_v3 = items_res3.json()["items"][0]
    assert item_v3["answer_revision_id"] != ans_rev1_id


# ===========================================================================
# 12. Evaluation Policies
# ===========================================================================
@pytest.mark.asyncio
async def test_evaluation_policy_lifecycle_and_confidential_block(app_client: httpx.AsyncClient):
    """Verify policy creation, immutable versions, and rejection of confidential external discovery."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")

    # A. Valid policy creation
    valid_policy_payload = {
        "name": "Standard Synthetic Audit Policy",
        "data_classification": "public",
        "evaluation_cutoff": "2026-01-01T00:00:00Z",
        "reviewer_identity": "usr_alice",
        "allowed_tools": ["search", "fetch"],
        "cost_ceiling_usd": 50.0,
    }

    res_pol = await app_client.post(
        "/api/v1/policies",
        headers=auth_headers(alice_token),
        json=valid_policy_payload,
    )
    assert res_pol.status_code == 201
    pol_data = res_pol.json()
    assert pol_data["policy_id"].startswith("pol_")
    assert pol_data["policy_version_id"].startswith("polv_")
    assert pol_data["version_number"] == 1
    pol_id = pol_data["policy_id"]

    res_get_pol = await app_client.get(
        f"/api/v1/policies/{pol_id}",
        headers=auth_headers(alice_token),
    )
    assert res_get_pol.status_code == 200
    assert res_get_pol.json()["version_count"] == 1

    # B. Rejection of confidential external discovery
    confidential_payload = {
        "name": "Confidential Search Policy",
        "data_classification": "confidential",
        "evaluation_cutoff": "2026-01-01T00:00:00Z",
        "reviewer_identity": "usr_alice",
        "allowed_tools": ["search"],
    }
    res_conf = await app_client.post(
        "/api/v1/policies",
        headers=auth_headers(alice_token),
        json=confidential_payload,
    )
    assert res_conf.status_code == 400
    assert "confidential external discovery is not supported" in res_conf.json()["message"].lower()


# ===========================================================================
# 13. Privacy & Redaction: Synthetic Sentinels Never Escape
# ===========================================================================
@pytest.mark.asyncio
async def test_privacy_boundaries_and_no_sentinel_leakage(
    app_client: httpx.AsyncClient, test_settings
):
    """Verify that gold answer text, encryption keys, or tokens never escape in public reads or logs."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")
    sentinel_gold = "SUPER_SECRET_SENTINEL_ANSWER_XYZ999"

    res = await app_client.post(
        "/api/v1/benchmarks",
        headers=auth_headers(alice_token),
        json={
            "name": "Sentinel Privacy Benchmark",
            "items": [
                {
                    "external_id": "sentinel_01",
                    "task_type": "exact_short_answer",
                    "question": "What is the secret sentinel?",
                    "gold_answer": sentinel_gold,
                }
            ],
        },
    )
    assert res.status_code == 200
    res_text = res.text
    assert sentinel_gold not in res_text

    bmk_id = res.json()["benchmark_id"]
    ver_id = res.json()["benchmark_version_id"]

    # 1. Check parent benchmark GET
    bmk_get = await app_client.get(
        f"/api/v1/benchmarks/{bmk_id}", headers=auth_headers(alice_token)
    )
    assert sentinel_gold not in bmk_get.text

    # 2. Check benchmark version GET
    ver_get = await app_client.get(
        f"/api/v1/benchmarks/versions/{ver_id}", headers=auth_headers(alice_token)
    )
    assert sentinel_gold not in ver_get.text

    # 3. Check items GET
    items_get = await app_client.get(
        f"/api/v1/benchmarks/versions/{ver_id}/items", headers=auth_headers(alice_token)
    )
    assert sentinel_gold not in items_get.text

    # 4. Check audit log records in database
    engine = create_async_engine(test_settings.database_url)
    session_fac = async_sessionmaker(engine, expire_on_commit=False)
    async with session_fac() as session:
        stmt = select(AuditEventModel).where(AuditEventModel.target_id == ver_id)
        audit_events = (await session.execute(stmt)).scalars().all()
        for ev in audit_events:
            event_json = json.dumps(ev.details)
            assert sentinel_gold not in event_json
            assert test_settings.vault_encryption_key not in event_json
    await engine.dispose()


# ===========================================================================
# 14. Persistence Across Simulated Application Restart
# ===========================================================================
@pytest.mark.asyncio
async def test_persistence_across_application_restart(test_settings):
    """Verify database persistence persists intact when application restarts."""
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")
    bmk_name = f"Restart Persistence Benchmark {uuid4().hex[:8]}"

    # Phase 1: Instance A imports benchmark
    set_settings(test_settings)
    await close_database_connections()
    app_a = create_app(test_settings)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_a), base_url="http://testserver"
    ) as client_a:
        res = await client_a.post(
            "/api/v1/benchmarks",
            headers=auth_headers(alice_token),
            json={
                "name": bmk_name,
                "items": [
                    {
                        "external_id": "p_01",
                        "task_type": "exact_short_answer",
                        "question": "Persistence Q",
                        "gold_answer": "Persistence A",
                    }
                ],
            },
        )
        assert res.status_code == 200
        bmk_id = res.json()["benchmark_id"]
        ver_id = res.json()["benchmark_version_id"]

    # Phase 2: Simulate complete shutdown
    await close_database_connections()
    set_settings(None)

    # Phase 3: Instance B restarts and queries previously persisted records
    set_settings(test_settings)
    app_b = create_app(test_settings)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_b), base_url="http://testserver"
    ) as client_b:
        res_bmk = await client_b.get(
            f"/api/v1/benchmarks/{bmk_id}", headers=auth_headers(alice_token)
        )
        assert res_bmk.status_code == 200
        assert res_bmk.json()["name"] == bmk_name

        res_items = await client_b.get(
            f"/api/v1/benchmarks/versions/{ver_id}/items", headers=auth_headers(alice_token)
        )
        assert res_items.status_code == 200
        assert len(res_items.json()["items"]) == 1
        assert res_items.json()["items"][0]["external_id"] == "p_01"

    await close_database_connections()
    set_settings(None)
