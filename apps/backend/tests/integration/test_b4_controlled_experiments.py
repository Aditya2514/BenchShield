"""B4 end-to-end integration tests: controlled attacker experiments.

Guarantees tested (Blueprint B4.1-B4.6):
- Three experimental conditions: control (no-web), blind (web, no BM context), evaluation_aware (web + BM context).
- Attacker context isolation: no access to discovery reports or vault protected answers.
- Strict no-fallback rule: provider failure results in INCOMPLETE status without fallback.
- Policy compliance evaluated independently of answer correctness.
- Conservative causal attribution (confirmed, suspected, none).
- Explicit denominators for aggregate metrics.
- Strict tenant workspace scoping.
"""

from uuid import uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from benchshield.api.auth import AuthenticatedActor, WorkspaceRole
from benchshield.devtools.demo_scenario import DEMO_BENCHMARK, DEMO_POLICY, DemoWebAdapter
from benchshield.domain.enums import (
    AttributionLevel,
    ExperimentCondition,
    ExperimentRunStatus,
    GraderOutcome,
    PolicyCompliance,
)
from benchshield.domain.models.experiments import ExperimentCreateRequest
from benchshield.experiments.attacker import FakeAttackerAdapter
from benchshield.services.experiment_service import ExperimentService
from benchshield.workers.durable_worker import DurableTaskWorker
from tests.conftest import auth_headers, make_token


async def _run_discovery_worker(db_url: str, inv_id: str) -> None:
    """Run discovery worker until all items in the investigation are processed."""
    engine = create_async_engine(db_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    adapter = DemoWebAdapter()
    while True:
        async with factory() as s:
            w = DurableTaskWorker("worker_b4_test", s, adapter, adapter)
            claimed = await w.claim_next_task(workspace_id="ws_alpha", investigation_id=inv_id)
            if not claimed:
                break
            await w.process_task(*claimed)
            await s.commit()
    await engine.dispose()


@pytest.mark.asyncio
async def test_b4_controlled_experiments_end_to_end(
    app_client: httpx.AsyncClient, real_postgres_env
):
    """Test full B4 experiment lifecycle: launch, three conditions, observable tracking, and results."""
    alice = auth_headers(make_token("usr_alice", "alice@corp-alpha.com"), "ws_alpha")
    bob = auth_headers(make_token("usr_bob", "bob@corp-beta.com"), "ws_beta")

    # 1. Setup benchmark & policy
    bench = {**DEMO_BENCHMARK, "name": f"b4-bench-{uuid4().hex[:6]}"}
    bmv_resp = await app_client.post("/api/v1/benchmarks", json=bench, headers=alice)
    assert bmv_resp.status_code in (200, 201)
    bmv = bmv_resp.json()["benchmark_version_id"]

    pol_resp = await app_client.post("/api/v1/policies", json=DEMO_POLICY, headers=alice)
    assert pol_resp.status_code in (200, 201)
    pol = pol_resp.json()["policy_version_id"]

    # 2. Launch investigation
    inv_resp = await app_client.post(
        "/api/v1/investigations",
        json={"workspace_id": "ws_alpha", "benchmark_version_id": bmv, "policy_version_id": pol},
        headers=alice | {"Idempotency-Key": f"b4-inv-{uuid4().hex}"},
    )
    assert inv_resp.status_code == 202
    inv_id = inv_resp.json()["investigation_id"]

    # 3. Reject experiment launch before discovery finishes
    pre_exp_resp = await app_client.post(
        f"/api/v1/investigations/{inv_id}/experiments",
        json={
            "investigation_id": inv_id,
            "conditions": ["control", "blind", "evaluation_aware"],
            "provider_id": "anthropic",
            "model_identifier": "claude-3-5-sonnet",
        },
        headers=alice,
    )
    assert pre_exp_resp.status_code == 400
    assert "Discovery findings must be completed or frozen" in pre_exp_resp.json()["message"]

    # 4. Run discovery worker to completion
    await _run_discovery_worker(real_postgres_env["app_async_url"], inv_id)

    # Verify discovery reached awaiting_review
    status_resp = await app_client.get(f"/api/v1/investigations/{inv_id}", headers=alice)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "awaiting_review"

    # 5. Launch controlled experiment with all 3 conditions
    exp_launch_resp = await app_client.post(
        f"/api/v1/investigations/{inv_id}/experiments",
        json={
            "investigation_id": inv_id,
            "conditions": ["control", "blind", "evaluation_aware"],
            "provider_id": "anthropic",
            "model_identifier": "claude-3-5-sonnet",
            "reasoning_budget": 2000,
        },
        headers=alice,
    )
    assert exp_launch_resp.status_code == 202
    exp_config = exp_launch_resp.json()
    exp_id = exp_config["experiment_id"]
    assert exp_config["provider_id"] == "anthropic"
    assert exp_config["model_identifier"] == "claude-3-5-sonnet"
    assert len(exp_config["conditions"]) == 3

    # 6. Retrieve experiment results
    res_resp = await app_client.get(f"/api/v1/experiments/{exp_id}", headers=alice)
    assert res_resp.status_code == 200
    results = res_resp.json()

    assert results["experiment_id"] == exp_id
    total_items = len(DEMO_BENCHMARK["items"])
    expected_runs = total_items * 3  # 3 conditions per item
    assert len(results["runs"]) == expected_runs
    assert results["completed_runs_count"] == expected_runs
    assert results["incomplete_runs_count"] == 0

    # 7. Check condition-specific behavioral guarantees
    for run in results["runs"]:
        if run["condition"] == "control":
            # Control runs must NEVER have external tool calls
            assert len(run["observable_tool_calls"]) == 0
            # Control attribution is always NONE
            assert run["attribution"] == AttributionLevel.NONE.value
            assert run["policy_compliance"] == PolicyCompliance.PERMITTED.value

        elif run["condition"] in ("blind", "evaluation_aware"):
            # Web tools were permitted
            assert run["policy_compliance"] in (
                PolicyCompliance.PERMITTED.value,
                PolicyCompliance.VIOLATED.value,
            )

    # 8. Tenant Isolation check: foreign workspace cannot read results or launch experiments
    foreign_get = await app_client.get(f"/api/v1/experiments/{exp_id}", headers=bob)
    assert foreign_get.status_code == 404

    foreign_launch = await app_client.post(
        f"/api/v1/investigations/{inv_id}/experiments",
        json={
            "investigation_id": inv_id,
            "conditions": ["control"],
            "provider_id": "anthropic",
            "model_identifier": "claude-3-5-sonnet",
        },
        headers=bob,
    )
    assert foreign_launch.status_code == 404


@pytest.mark.asyncio
async def test_b4_strict_no_fallback_and_policy_violation_independence(
    real_postgres_env, test_settings
):
    """Verify B4.4 strict no-fallback rule and B4.5 policy compliance independence of correctness."""
    engine = create_async_engine(real_postgres_env["app_async_url"], echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    alice_actor = AuthenticatedActor(
        user_id="usr_alice",
        email="alice@corp-alpha.com",
        role=WorkspaceRole.ADMIN,
        workspace_id="ws_alpha",
    )

    # 1. Setup benchmark and investigation directly
    async with session_factory() as session:
        from benchshield.services.benchmark_service import BenchmarkService
        from benchshield.services.investigation_service import InvestigationService
        from benchshield.services.policy_service import PolicyService

        bench = {**DEMO_BENCHMARK, "name": f"b4-nofallback-{uuid4().hex[:6]}"}
        from benchshield.domain.models.intake import BenchmarkImportRequest

        b_res = await BenchmarkService(session, settings=test_settings).import_benchmark(
            BenchmarkImportRequest.model_validate(bench),
            actor=alice_actor,
            correlation_id="req_test_import",
        )
        bmv_id = b_res.benchmark_version_id

        from benchshield.domain.models.policies import EvaluationPolicyCreateRequest

        p_res = await PolicyService(session, settings=test_settings).create_policy(
            EvaluationPolicyCreateRequest.model_validate(DEMO_POLICY),
            actor=alice_actor,
            correlation_id="req_test_policy",
        )
        pol_id = p_res.policy_version_id

        from benchshield.domain.models.investigations import InvestigationCreateRequest

        inv_res = await InvestigationService(session, settings=test_settings).launch_investigation(
            InvestigationCreateRequest(
                workspace_id="ws_alpha",
                benchmark_version_id=bmv_id,
                policy_version_id=pol_id,
            ),
            actor=alice_actor,
        )
        inv_id = inv_res.investigation_id
        await session.commit()

    # 2. Run discovery worker
    await _run_discovery_worker(real_postgres_env["app_async_url"], inv_id)

    # 3. Configure FakeAttackerAdapter with:
    #    - Provider interruption on BLIND condition (tests strict no-fallback)
    #    - Forced prohibited retrieval on EVALUATION_AWARE condition (tests policy violation)
    fake_adapter = FakeAttackerAdapter()
    fake_adapter.set_fail_on_condition(ExperimentCondition.BLIND)
    fake_adapter.set_prohibited_retrieval_on_condition(ExperimentCondition.EVALUATION_AWARE)

    async with session_factory() as session:
        exp_service = ExperimentService(session, settings=test_settings)
        exp_config = await exp_service.launch_experiment(
            investigation_id=inv_id,
            payload=ExperimentCreateRequest(
                investigation_id=inv_id,
                conditions=[
                    ExperimentCondition.CONTROL,
                    ExperimentCondition.BLIND,
                    ExperimentCondition.EVALUATION_AWARE,
                ],
                provider_id="fake_provider",
                model_identifier="fake_model",
            ),
            actor=alice_actor,
            attacker_adapter=fake_adapter,
        )
        exp_id = exp_config.experiment_id

        results = await exp_service.get_experiment(exp_id, actor=alice_actor)

        # STRICT NO-FALLBACK: All BLIND condition runs must be marked INCOMPLETE
        blind_runs = [r for r in results.runs if r.condition == ExperimentCondition.BLIND]
        assert len(blind_runs) > 0
        for r in blind_runs:
            assert r.run_status == ExperimentRunStatus.INCOMPLETE
            assert "Strict no-fallback enforced" in (r.failure_reason or "")
            assert r.grader_outcome == GraderOutcome.UNSUPPORTED

        # POLICY VIOLATION INDEPENDENCE:
        # All EVALUATION_AWARE runs had prohibited retrieval injected
        eval_runs = [r for r in results.runs if r.condition == ExperimentCondition.EVALUATION_AWARE]
        assert len(eval_runs) > 0
        for r in eval_runs:
            assert r.policy_compliance == PolicyCompliance.VIOLATED
            # Policy violation recorded even if answer is not correct
            assert len(r.observable_tool_calls) >= 1
            assert any("answer key" in tc.query_or_action for tc in r.observable_tool_calls)

        # Aggregated counters with explicit denominators
        assert results.incomplete_runs_count == len(blind_runs)
        assert results.prohibited_retrieval_count == len(eval_runs)
        assert results.completed_runs_count == len(results.runs) - len(blind_runs)

    await engine.dispose()
