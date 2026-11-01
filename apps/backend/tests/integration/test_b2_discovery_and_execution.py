"""Comprehensive real PostgreSQL integration test suite for BenchShield Phase B2.

Demonstrates the 7 core requirements of Bounded Discovery and Durable Execution:
1. Unauthorized access & cross-workspace tenant isolation.
2. Concurrent idempotency on investigation launches.
3. Lease expiry and worker crash recovery.
4. Fencing token stale commit rejection (preventing split-brain zombie workers).
5. Budget exhaustion before dispatch (failing fast before external queries).
6. Controlled web adapters with strict SSRF blocking (private IPs, cloud metadata, forbidden schemes).
7. Cancellation preserving partial candidate evidence and enforcing the honest B2/B3 phase boundary.
8. Authenticated SSE streaming with monotonic sequence replay (Last-Event-ID).
9. Live TinyFish adapter verification (when API key is present).
"""

import asyncio
import os
from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from benchshield.api.auth import AuthenticatedActor, WorkspaceRole
from benchshield.domain.enums import InvestigationStatus
from benchshield.domain.models.investigations import (
    InvestigationCreateRequest,
)
from benchshield.persistence.models import (
    BenchmarkModel,
    BenchmarkVersionModel,
    CandidateSourceModel,
    EvaluationPolicyVersionModel,
    InvestigationModel,
    InvestigationTaskModel,
    ItemVersionModel,
)
from benchshield.services.budget_service import BudgetExhaustedException, BudgetService
from benchshield.services.investigation_service import InvestigationService
from benchshield.web.adapter_interface import SearchResultItem
from benchshield.web.fake_web_adapter import FakeWebAdapter
from benchshield.web.ssrf_protection import SSRFViolationError, validate_url_safe_for_fetch
from benchshield.web.tinyfish_adapter import TinyFishAdapter
from benchshield.workers.durable_worker import DurableTaskWorker, StaleTaskCommitError
from tests.conftest import auth_headers, make_token


# ---------------------------------------------------------------------------
# Test Helpers: Seed Benchmark & Policy in Test Database
# ---------------------------------------------------------------------------
async def seed_benchmark_and_policy(
    db_url: str,
    workspace_id: str = "ws_alpha",
    item_count: int = 3,
    max_queries: int = 5,
    max_fetches: int = 5,
) -> tuple[str, str, list[str]]:
    """Seed benchmark, benchmark_version, item_versions, and policy_version."""
    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        # 1. Benchmark
        bm_id = f"bm_{uuid4().hex[:12]}"
        bm = BenchmarkModel(
            id=bm_id,
            workspace_id=workspace_id,
            name=f"Evaluation Benchmark {bm_id}",
            description="Test benchmark for discovery audits",
        )
        session.add(bm)

        # 2. Benchmark Version
        bmv_id = f"bmv_{uuid4().hex[:12]}"
        bmv = BenchmarkVersionModel(
            id=bmv_id,
            benchmark_id=bm.id,
            workspace_id=workspace_id,
            version_number=1,
            item_count=item_count,
            task_types=["exact_short_answer"],
        )
        session.add(bmv)

        # 3. Item Versions (Public items without gold answers)
        item_ids = []
        for i in range(1, item_count + 1):
            itv_id = f"itv_{uuid4().hex[:12]}"
            itv = ItemVersionModel(
                id=itv_id,
                benchmark_version_id=bmv.id,
                workspace_id=workspace_id,
                external_id=f"item_ext_{i}",
                task_type="exact_short_answer",
                question=f"What is the theoretical upper bound on Transformer attention complexity for sequence length N {i}?",
                choices=None,
                answer_revision_id=f"anr_{uuid4().hex[:16]}",  # Opaque persistence ID
                metadata_={"domain": "machine_learning", "difficulty": "hard"},
            )
            session.add(itv)
            item_ids.append(itv_id)

        # 4. Evaluation Policy Version
        polv_id = f"polv_{uuid4().hex[:12]}"
        policy = EvaluationPolicyVersionModel(
            id=polv_id,
            policy_id=f"pol_{uuid4().hex[:12]}",
            workspace_id=workspace_id,
            version_number=1,
            name="Standard Exposure Audit Policy",
            data_classification="public",
            allowed_tools=["search", "scrape"],
            allowed_source_classes=["web", "code_repository", "academic_archive"],
            prohibited_answer_key_access=True,
            benchmark_identification_permitted=False,
            evaluation_cutoff=datetime(2024, 1, 1, tzinfo=UTC),
            cutoff_timezone="UTC",
            max_queries_per_item=max_queries,
            max_fetches_per_item=max_fetches,
            max_concurrent_discovery_tasks=2,
            deadline_seconds=600,
            cost_ceiling_usd=10.0,
            retention_profile="pilot_standard_30_90",
            reviewer_identity="security-team@corp-alpha.com",
        )
        session.add(policy)
        await session.commit()

    await engine.dispose()
    return bmv_id, polv_id, item_ids


# ---------------------------------------------------------------------------
# Requirement 1: Unauthorized Access & Cross-Workspace Tenant Isolation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_unauthorized_access_and_cross_workspace_isolation(
    app_client: httpx.AsyncClient,
    real_postgres_env,
):
    """Verify tenant isolation and RBAC: 401 on missing token, 403 on missing permission or wrong tenant."""
    bmv_id, polv_id, _ = await seed_benchmark_and_policy(
        real_postgres_env["app_async_url"], "ws_alpha"
    )

    # 1. Missing Authorization header -> 401
    res = await app_client.post(
        "/api/v1/investigations",
        json={
            "workspace_id": "ws_alpha",
            "benchmark_version_id": bmv_id,
            "policy_version_id": polv_id,
        },
        headers={"Idempotency-Key": "test_idemp_unauth"},
    )
    assert res.status_code == 401

    # 2. Viewer role attempting launch_investigation -> 403 Forbidden
    viewer_token = make_token("usr_charlie", "charlie@corp-alpha.com")
    res_viewer = await app_client.post(
        "/api/v1/investigations",
        json={
            "workspace_id": "ws_alpha",
            "benchmark_version_id": bmv_id,
            "policy_version_id": polv_id,
        },
        headers=auth_headers(viewer_token, "ws_alpha", {"Idempotency-Key": "test_idemp_viewer"}),
    )
    assert res_viewer.status_code == 403
    assert "lacks required permission" in res_viewer.json()["message"]

    # 3. User from ws_beta attempting to launch investigation on ws_alpha -> 403 Forbidden
    bob_token = make_token("usr_bob", "bob@corp-beta.com")
    res_cross = await app_client.post(
        "/api/v1/investigations",
        json={
            "workspace_id": "ws_alpha",
            "benchmark_version_id": bmv_id,
            "policy_version_id": polv_id,
        },
        headers=auth_headers(bob_token, "ws_beta", {"Idempotency-Key": "test_idemp_cross"}),
    )
    assert res_cross.status_code == 403
    assert "Cannot launch investigation in foreign workspace" in res_cross.json()["message"]

    # 4. Valid launch in ws_alpha by admin usr_alice
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")
    res_launch = await app_client.post(
        "/api/v1/investigations",
        json={
            "workspace_id": "ws_alpha",
            "benchmark_version_id": bmv_id,
            "policy_version_id": polv_id,
        },
        headers=auth_headers(
            alice_token, "ws_alpha", {"Idempotency-Key": "test_idemp_alice_launch"}
        ),
    )
    assert res_launch.status_code == 202
    inv_id = res_launch.json()["investigation_id"]

    # 5. Cross-workspace read: usr_bob in ws_beta queries ws_alpha investigation -> 404 Not Found
    res_cross_read = await app_client.get(
        f"/api/v1/investigations/{inv_id}",
        headers=auth_headers(bob_token, "ws_beta"),
    )
    assert res_cross_read.status_code == 404


# ---------------------------------------------------------------------------
# Requirement 2: Concurrent Idempotency
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_concurrent_idempotency_investigation_launch(
    app_client: httpx.AsyncClient,
    real_postgres_env,
):
    """Verify that multiple concurrent requests with the same Idempotency-Key return identical results."""
    bmv_id, polv_id, _ = await seed_benchmark_and_policy(
        real_postgres_env["app_async_url"], "ws_alpha"
    )
    alice_token = make_token("usr_alice", "alice@corp-alpha.com")
    idemp_key = f"idemp_concurrent_{uuid4().hex[:8]}"

    payload = {
        "workspace_id": "ws_alpha",
        "benchmark_version_id": bmv_id,
        "policy_version_id": polv_id,
    }

    # Dispatch 3 concurrent launches with identical key
    coros = [
        app_client.post(
            "/api/v1/investigations",
            json=payload,
            headers=auth_headers(alice_token, "ws_alpha", {"Idempotency-Key": idemp_key}),
        )
        for _ in range(3)
    ]
    responses = await asyncio.gather(*coros)

    status_codes = [r.status_code for r in responses]
    assert all(code == 202 for code in status_codes)

    inv_ids = [r.json()["investigation_id"] for r in responses]
    # All responses must reference the same single investigation ID
    assert len(set(inv_ids)) == 1

    # Verify conflicting payload with same key returns 409 Conflict
    conflicting_payload = {
        "workspace_id": "ws_alpha",
        "benchmark_version_id": bmv_id,
        "policy_version_id": polv_id,
        # altered payload
    }
    # Create another policy to make it conflict
    _, pol2_id, _ = await seed_benchmark_and_policy(real_postgres_env["app_async_url"], "ws_alpha")
    conflicting_payload["policy_version_id"] = pol2_id

    res_conflict = await app_client.post(
        "/api/v1/investigations",
        json=conflicting_payload,
        headers=auth_headers(alice_token, "ws_alpha", {"Idempotency-Key": idemp_key}),
    )
    assert res_conflict.status_code == 409


# ---------------------------------------------------------------------------
# Requirement 3 & 4: Durable Worker Leases, Recovery & Fencing Token Stale Commit Rejection
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_lease_expiry_worker_recovery_and_fencing_rejection(real_postgres_env):
    """Demonstrate lease expiry, worker recovery, and rejection of stale worker commits via fencing token."""
    engine = create_async_engine(real_postgres_env["app_async_url"], echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    bmv_id, polv_id, item_ids = await seed_benchmark_and_policy(
        real_postgres_env["app_async_url"], "ws_alpha", item_count=1
    )

    async with session_factory() as session:
        inv_service = InvestigationService(session)
        actor = AuthenticatedActor(
            user_id="usr_alice",
            email="alice@corp-alpha.com",
            role=WorkspaceRole.ADMIN,
            workspace_id="ws_alpha",
        )
        inv_resp = await inv_service.launch_investigation(
            InvestigationCreateRequest(
                workspace_id="ws_alpha",
                benchmark_version_id=bmv_id,
                policy_version_id=polv_id,
            ),
            actor=actor,
        )
        await session.commit()

    inv_id = inv_resp.investigation_id

    # 1. Worker 1 claims task with short 1-second lease
    fake_adapter = FakeWebAdapter()
    async with session_factory() as session1:
        worker1 = DurableTaskWorker(
            "worker_1", session1, fake_adapter, fake_adapter, lease_seconds=1
        )
        claimed1 = await worker1.claim_next_task(workspace_id="ws_alpha", investigation_id=inv_id)
        assert claimed1 is not None
        task1, fencing_token_1 = claimed1
        assert task1.claimed_by == "worker_1"
        assert fencing_token_1 == 1
        await session1.commit()

    # 2. Worker 1 simulates stall / sleep until lease expires
    await asyncio.sleep(1.2)

    # 3. Worker 2 detects expired lease and reclaims the task with fencing token bump
    async with session_factory() as session2:
        worker2 = DurableTaskWorker(
            "worker_2", session2, fake_adapter, fake_adapter, lease_seconds=60
        )
        claimed2 = await worker2.claim_next_task(workspace_id="ws_alpha", investigation_id=inv_id)
        assert claimed2 is not None
        task2, fencing_token_2 = claimed2
        assert task2.id == task1.id
        assert task2.claimed_by == "worker_2"
        # Fencing token must be monotonically higher!
        assert fencing_token_2 == 2
        await session2.commit()

    # 4. Worker 1 wakes up and attempts to complete task with stale fencing_token_1 -> MUST BE REJECTED
    async with session_factory() as session1:
        worker1_stale = DurableTaskWorker("worker_1", session1, fake_adapter, fake_adapter)
        with pytest.raises(StaleTaskCommitError) as exc_info:
            await worker1_stale._commit_task_completion(task1.id, fencing_token=fencing_token_1)
        assert "Stale commit rejected" in str(exc_info.value)
        await session1.rollback()

    # 5. Worker 2 successfully completes task with valid fencing_token_2
    async with session_factory() as session2:
        worker2_valid = DurableTaskWorker("worker_2", session2, fake_adapter, fake_adapter)
        await worker2_valid._commit_task_completion(task2.id, fencing_token=fencing_token_2)
        await session2.commit()

        # Verify task is completed by worker_2
        task_check = await session2.get(InvestigationTaskModel, task2.id)
        assert task_check.status == "completed"
        assert task_check.fencing_token == 2
        assert task_check.claimed_by == "worker_2"

    await engine.dispose()


# ---------------------------------------------------------------------------
# Requirement 5: Budget Exhaustion Before Dispatch
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_budget_exhaustion_before_dispatch(real_postgres_env):
    """Verify that resource budgets are checked and rejected before executing external queries."""
    engine = create_async_engine(real_postgres_env["app_async_url"], echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # Seed benchmark with 2 items, but policy with only 1 query allowed
    bmv_id, polv_id, item_ids = await seed_benchmark_and_policy(
        real_postgres_env["app_async_url"], "ws_alpha", item_count=2, max_queries=1
    )

    async with session_factory() as session:
        inv_service = InvestigationService(session)
        actor = AuthenticatedActor(
            user_id="usr_alice",
            email="alice@corp-alpha.com",
            role=WorkspaceRole.ADMIN,
            workspace_id="ws_alpha",
        )
        inv_resp = await inv_service.launch_investigation(
            InvestigationCreateRequest(
                workspace_id="ws_alpha",
                benchmark_version_id=bmv_id,
                policy_version_id=polv_id,
            ),
            actor=actor,
        )
        await session.commit()

        budget_service = BudgetService(session)
        inv = await session.get(InvestigationModel, inv_resp.investigation_id)
        # Override budget_config to strict 1 query ceiling
        inv.budget_config = {"max_queries": 1, "max_fetches": 1, "cost_ceiling_usd": 1.0}
        await session.commit()

        # First reservation of 1 query succeeds
        res1 = await budget_service.reserve_budget(inv, "queries", amount=1)
        assert res1.status == "reserved"
        await budget_service.reconcile_usage(res1, used_amount=1)
        await session.commit()

        # Second query reservation fails immediately with BudgetExhaustedException BEFORE calling external provider
        with pytest.raises(BudgetExhaustedException) as exc_info:
            await budget_service.reserve_budget(inv, "queries", amount=1)
        assert "Resource budget exhausted for 'queries'" in str(exc_info.value)
        assert exc_info.value.requested == 1
        assert exc_info.value.available == 0

    await engine.dispose()


# ---------------------------------------------------------------------------
# Requirement 6: Controlled Web Adapters & SSRF Protection
# ---------------------------------------------------------------------------
def test_ssrf_blocking_boundaries():
    """Verify SSRF validation strictly blocks loopback, private subnets, cloud metadata, and non-http schemes."""
    # 1. Prohibited Schemes
    with pytest.raises(SSRFViolationError) as exc:
        validate_url_safe_for_fetch("file:///etc/passwd")
    assert "Prohibited scheme" in str(exc.value)

    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("gopher://127.0.0.1:70")

    # 2. Loopback addresses
    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("http://127.0.0.1:8000/admin")

    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("http://localhost:5432")

    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("http://[::1]/secret")

    # 3. Cloud Metadata IPs and Hostnames
    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("http://169.254.169.254/latest/meta-data/")

    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("http://metadata.google.internal/computeMetadata/v1/")

    # 4. RFC 1918 Private Subnets
    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("http://10.0.0.5/api")

    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("http://172.16.50.10:8080")

    with pytest.raises(SSRFViolationError):
        validate_url_safe_for_fetch("http://192.168.1.1/router")

    # 5. Legitimate public URLs pass
    safe_url = validate_url_safe_for_fetch("https://en.wikipedia.org/wiki/Artificial_intelligence")
    assert safe_url == "https://en.wikipedia.org/wiki/Artificial_intelligence"


@pytest.mark.asyncio
async def test_fake_web_adapter_redirect_ssrf_detection():
    """Verify fake adapter blocks redirects attempting to jump into private address space."""
    adapter = FakeWebAdapter()
    # Configure malicious redirect chain
    adapter.register_snapshot(
        "https://public-site.org/redirect-service",
        content="",
        redirects=[
            "https://public-site.org/redirect-service",
            "http://169.254.169.254/latest/meta-data",
        ],
    )

    with pytest.raises(SSRFViolationError) as exc:
        await adapter.fetch("https://public-site.org/redirect-service")
    assert "violates internal network isolation" in str(exc.value) or "restricted" in str(exc.value)


# ---------------------------------------------------------------------------
# Requirement 7: Cancellation, Partial Candidate Preservation & Honest Phase Boundary
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cancellation_and_partial_candidate_preservation(
    app_client: httpx.AsyncClient,
    real_postgres_env,
):
    """Verify that cancellation preserves already discovered candidate evidence, marks is_partial=True, and refuses resurrection."""
    engine = create_async_engine(real_postgres_env["app_async_url"], echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    bmv_id, polv_id, item_ids = await seed_benchmark_and_policy(
        real_postgres_env["app_async_url"], "ws_alpha", item_count=3
    )

    alice_token = make_token("usr_alice", "alice@corp-alpha.com")

    # 1. Launch investigation
    res_launch = await app_client.post(
        "/api/v1/investigations",
        json={
            "workspace_id": "ws_alpha",
            "benchmark_version_id": bmv_id,
            "policy_version_id": polv_id,
        },
        headers=auth_headers(
            alice_token, "ws_alpha", {"Idempotency-Key": f"idemp_cancel_{uuid4().hex[:8]}"}
        ),
    )
    assert res_launch.status_code == 202
    inv_id = res_launch.json()["investigation_id"]

    # 2. Worker executes 1 item and inserts a candidate source
    fake_adapter = FakeWebAdapter()
    fake_adapter.register_search_result(
        "transformer",
        [
            SearchResultItem(
                url="https://github.com/public-repo/transformer-benchmark",
                title="Public Transformer Benchmark Harness",
                domain="github.com",
            )
        ],
    )
    fake_adapter.register_snapshot(
        "https://github.com/public-repo/transformer-benchmark",
        "Discovered code containing benchmark question text.",
    )

    async with session_factory() as session:
        worker = DurableTaskWorker("worker_cancel_test", session, fake_adapter, fake_adapter)
        claimed = await worker.claim_next_task(workspace_id="ws_alpha", investigation_id=inv_id)
        assert claimed is not None
        task, fencing_token = claimed
        # Process the single task
        await worker.process_task(task, fencing_token)
        await session.commit()

    # 3. Client issues cancellation
    res_cancel = await app_client.post(
        f"/api/v1/investigations/{inv_id}/cancel",
        json={"reason": "Operator manually stopped investigation."},
        headers=auth_headers(alice_token, "ws_alpha"),
    )
    assert res_cancel.status_code == 200
    cancel_data = res_cancel.json()
    assert cancel_data["status"] == InvestigationStatus.CANCELLED

    # 4. Verify investigation status: cancelled, is_partial=True, findings preserved
    res_status = await app_client.get(
        f"/api/v1/investigations/{inv_id}",
        headers=auth_headers(alice_token, "ws_alpha"),
    )
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["status"] == InvestigationStatus.CANCELLED
    assert status_data["is_partial"] is True
    # At least 1 candidate finding was preserved!
    assert status_data["findings_count"] >= 1

    # 5. Verify database integrity and HONEST B2 LABEL: candidate sources status must be 'candidate'
    async with session_factory() as session:
        src_stmt = select(CandidateSourceModel).where(
            CandidateSourceModel.investigation_id == inv_id
        )
        candidates = (await session.execute(src_stmt)).scalars().all()
        assert len(candidates) >= 1
        for c in candidates:
            # Strict B2 Phase Boundary: must be candidate only, no verified claims in B2!
            assert c.status == "candidate"

        # Check pending tasks were marked cancelled
        pending_stmt = select(InvestigationTaskModel).where(
            InvestigationTaskModel.investigation_id == inv_id,
            InvestigationTaskModel.status == "pending",
        )
        remaining_pending = (await session.execute(pending_stmt)).scalars().all()
        assert len(remaining_pending) == 0

    # 6. Idempotent re-cancel returns confirmation
    res_recancel = await app_client.post(
        f"/api/v1/investigations/{inv_id}/cancel",
        json={"reason": "Repeat cancellation request."},
        headers=auth_headers(alice_token, "ws_alpha"),
    )
    assert res_recancel.status_code == 200
    assert res_recancel.json()["status"] == InvestigationStatus.CANCELLED

    await engine.dispose()


# ---------------------------------------------------------------------------
# Requirement 8: Server-Sent Events (SSE) Streaming & Last-Event-ID Replay
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sse_stream_with_monotonic_replay(real_postgres_env):
    """Verify SSE streaming emits typed events and correctly replays from Last-Event-ID cursor."""
    engine = create_async_engine(real_postgres_env["app_async_url"], echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    bmv_id, polv_id, item_ids = await seed_benchmark_and_policy(
        real_postgres_env["app_async_url"], "ws_alpha", item_count=1
    )

    actor = AuthenticatedActor(
        user_id="usr_alice",
        email="alice@corp-alpha.com",
        role=WorkspaceRole.ADMIN,
        workspace_id="ws_alpha",
    )

    async with session_factory() as session:
        inv_service = InvestigationService(session)
        inv_resp = await inv_service.launch_investigation(
            InvestigationCreateRequest(
                workspace_id="ws_alpha",
                benchmark_version_id=bmv_id,
                policy_version_id=polv_id,
            ),
            actor=actor,
        )
        inv_id = inv_resp.investigation_id
        await session.commit()

        # Process task with fake adapter
        fake_adapter = FakeWebAdapter()
        fake_adapter.register_search_result(
            "transformer",
            [
                SearchResultItem(
                    url="https://arxiv.org/abs/2401.12345",
                    title="Transformer Attention Analysis",
                    domain="arxiv.org",
                )
            ],
        )
        worker = DurableTaskWorker("worker_sse_test", session, fake_adapter, fake_adapter)
        claimed = await worker.claim_next_task(workspace_id="ws_alpha", investigation_id=inv_id)
        assert claimed is not None
        task, fencing_token = claimed
        await worker.process_task(task, fencing_token)
        await session.commit()

    # 1. Connect and stream from beginning
    async with session_factory() as session:
        inv_service = InvestigationService(session)
        stream_gen = inv_service.get_event_stream(inv_id, actor=actor)

        chunks = []
        async for chunk in stream_gen:
            chunks.append(chunk)
            if "investigation_completed" in chunk:
                break

        full_stream_text = "".join(chunks)
        assert "event: investigation_queued" in full_stream_text
        assert "event: item_investigation_started" in full_stream_text
        assert "event: candidate_discovered" in full_stream_text
        assert "event: investigation_completed" in full_stream_text

    # 2. Replay with Last-Event-ID: 2 -> only events after sequence 2 are returned
    async with session_factory() as session:
        inv_service = InvestigationService(session)
        replay_gen = inv_service.get_event_stream(inv_id, actor=actor, last_event_id="2")

        replay_chunks = []
        async for chunk in replay_gen:
            replay_chunks.append(chunk)
            if "investigation_completed" in chunk:
                break

        replay_text = "".join(replay_chunks)
        # Sequence 1 and 2 must NOT be present
        assert "id: 1\n" not in replay_text
        assert "id: 2\n" not in replay_text
        # Sequence 3+ must be present
        assert "id: 3\n" in replay_text or "id: 4\n" in replay_text

    await engine.dispose()


# ---------------------------------------------------------------------------
# Requirement 9: Live TinyFish Search and Fetch (if API key present)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_tinyfish_live_search_and_fetch():
    """Verify live TinyFish SDK adapter when TINYFISH_API_KEY environment variable is present."""
    api_key = os.environ.get("TINYFISH_API_KEY")
    if not api_key:
        pytest.skip(
            "TINYFISH_API_KEY environment variable not set; skipping live web adapter test."
        )

    adapter = TinyFishAdapter(api_key=api_key)

    # 1. Live Search
    query = "site:wikipedia.org artificial intelligence benchmark"
    results = await adapter.search(query, max_results=3)
    assert len(results) > 0
    assert any("wikipedia.org" in r.url for r in results)
    first_res = results[0]
    assert first_res.url.startswith("http")
    assert len(first_res.title) > 0

    # 2. Live Fetch
    snapshot = await adapter.fetch(
        "https://en.wikipedia.org/wiki/Artificial_intelligence", max_bytes=50_000
    )
    assert snapshot.url.startswith("https://")
    assert len(snapshot.content) > 0
    assert snapshot.size_bytes > 0
    assert len(snapshot.content_sha256) == 64
    assert snapshot.media_type == "text/markdown"
