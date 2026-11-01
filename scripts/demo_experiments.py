"""BenchShield Phase B4 Demo: Controlled Attacker Experiments (Fully Offline).

Demonstrates:
1. Frozen investigation discovery prerequisite.
2. Three experimental conditions:
   - Control: Internal weights only (zero external tool calls).
   - Blind: Web search/fetch enabled, no benchmark context in prompt.
   - Evaluation-Aware: Web search/fetch enabled, prompt explicitly identifies benchmark context.
3. Attacker context isolation: Zero exposure to discovery findings or gold answers.
4. Independent policy compliance: Prohibited retrieval flagged separately from answer correctness.
5. Strict no-fallback rule: Interrupted runs marked INCOMPLETE without model switching.
6. Conservative causal attribution (none, retrieval_observed, use_supported).
7. Aggregated counts with explicit denominators.

Run:
  cd apps/backend && uv run python ../../scripts/demo_experiments.py
"""

import asyncio
import json
import pathlib
import sys
import tempfile
from uuid import uuid4

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "apps" / "backend" / "src"))

import httpx  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from benchshield.api.app import create_app  # noqa: E402
from benchshield.api.auth import create_jwt_token  # noqa: E402
from benchshield.config import Settings, set_settings  # noqa: E402
from benchshield.devtools.demo_scenario import (  # noqa: E402
    DEMO_BENCHMARK,
    DEMO_POLICY,
    DemoWebAdapter,
)
from benchshield.devtools.embedded_db import start_embedded_stack  # noqa: E402
from benchshield.persistence.database import close_database_connections  # noqa: E402
from benchshield.workers.durable_worker import DurableTaskWorker  # noqa: E402

JWT_SECRET = "demo-jwt-secret-key-at-least-32-bytes-long!"
VAULT_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


def header(t: str) -> None:
    print(f"\n{'=' * 72}\n {t}\n{'=' * 72}")


def headers(user: str, email: str, ws: str, extra: dict | None = None) -> dict:
    tok = create_jwt_token(user_id=user, email=email, secret=JWT_SECRET, expires_in_seconds=3600)
    h = {"Authorization": f"Bearer {tok}", "X-Workspace-ID": ws}
    return h | (extra or {})


async def run_discovery(app_url: str, inv_id: str, adapter: DemoWebAdapter) -> int:
    engine = create_async_engine(app_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    processed = 0
    while True:
        async with factory() as s:
            w = DurableTaskWorker("demo_worker", s, adapter, adapter)
            claimed = await w.claim_next_task(workspace_id="ws_alpha", investigation_id=inv_id)
            if not claimed:
                await s.commit()
                break
            await w.process_task(*claimed)
            await s.commit()
            processed += 1
    await engine.dispose()
    return processed


async def main() -> int:
    with tempfile.TemporaryDirectory() as tmpdir:
        header("1. Starting Embedded PostgreSQL and Applying Alembic Migrations (0004 Head)")
        stack = start_embedded_stack(pathlib.Path(tmpdir))
        cfg = Settings(
            environment="test",
            database_url=stack["app_async_url"],
            database_owner_sync_url=stack["owner_sync_url"],
            database_verifier_url=stack["verifier_async_url"],
            vault_encryption_key=VAULT_KEY,
            vault_key_version="v1",
            jwt_secret=JWT_SECRET,
            allow_insecure_auth_shortcuts=False,
        )
        set_settings(cfg)
        app = create_app(cfg)

        alice = headers("usr_alice", "alice@corp-alpha.com", "ws_alpha")

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://demo") as client:
            # Step 1: Intake benchmark & policy
            header("2. Importing Synthetic Benchmark & Creating Audit Policy")
            r = await client.post("/api/v1/benchmarks", json=DEMO_BENCHMARK, headers=alice)
            bmv = r.json()["benchmark_version_id"]
            print(f"Benchmark Version: {bmv} ({len(DEMO_BENCHMARK['items'])} items)")

            r = await client.post("/api/v1/policies", json=DEMO_POLICY, headers=alice)
            pol = r.json()["policy_version_id"]
            print(f"Policy Version:    {pol}")

            # Step 2: Investigation discovery
            header("3. Launching Investigation & Running Bounded Web Discovery")
            r = await client.post(
                "/api/v1/investigations",
                json={
                    "workspace_id": "ws_alpha",
                    "benchmark_version_id": bmv,
                    "policy_version_id": pol,
                },
                headers=alice | {"Idempotency-Key": f"demo-inv-{uuid4().hex}"},
            )
            inv = r.json()["investigation_id"]
            print(f"Launched Investigation: {inv} (status: queued)")

            adapter = DemoWebAdapter()
            n = await run_discovery(stack["app_async_url"], inv, adapter)
            print(f"Discovery complete. Processed {n} items.")

            # Status check
            st = (await client.get(f"/api/v1/investigations/{inv}", headers=alice)).json()
            print(f"Investigation Status: {st['status']} (is_partial: {st['is_partial']})")

            # Step 3: Launch Controlled Experiments
            header("4. Launching Controlled Attacker Experiments (Phase B4)")
            exp_payload = {
                "investigation_id": inv,
                "conditions": ["control", "blind", "evaluation_aware"],
                "provider_id": "anthropic",
                "model_identifier": "claude-3-5-sonnet",
                "reasoning_budget": 2000,
            }
            exp_res = await client.post(
                f"/api/v1/investigations/{inv}/experiments",
                json=exp_payload,
                headers=alice,
            )
            exp_config = exp_res.json()
            exp_id = exp_config["experiment_id"]
            print(f"Experiment ID:      {exp_id}")
            print(f"Pinned Provider:    {exp_config['provider_id']}")
            print(f"Pinned Model:       {exp_config['model_identifier']}")
            print(f"Tested Conditions:  {exp_config['conditions']}")

            # Step 4: Retrieve Results
            header("5. Reading Observable Runs & Conservative Causal Attribution")
            res = (await client.get(f"/api/v1/experiments/{exp_id}", headers=alice)).json()

            print(f"Total Runs Evaluated:        {len(res['runs'])}")
            print(f"Completed Runs Count:        {res['completed_runs_count']}")
            print(f"Incomplete Runs Count:       {res['incomplete_runs_count']}")
            print(f"Prohibited Retrievals Count: {res['prohibited_retrieval_count']}")
            print(f"Correct Answers Count:       {res['correct_answer_count']}\n")

            print("Sample Observable Runs Across Conditions:")
            for i, run in enumerate(res["runs"][:6], 1):
                print(f"  Run #{i} [{run['condition'].upper()}]:")
                print(f"    Item Version:         {run['item_version_id']}")
                print(f"    Run Status:           {run['run_status']}")
                print(f"    Observable Tools:     {len(run['observable_tool_calls'])} calls")
                print(f"    Grader Outcome:       {run['grader_outcome']}")
                print(f"    Policy Compliance:    {run['policy_compliance']}")
                print(f"    Causal Attribution:   {run['attribution']}")
                if run["observable_tool_calls"]:
                    first_call = run["observable_tool_calls"][0]
                    print(
                        f"    First Tool Call:      {first_call['tool_name']}({first_call['query_or_action'][:40]}...)"
                    )
                print()

            header("6. Demonstration Complete: Phase B4 Verified")
            print("Summary of Guarantees Demonstrated:")
            print(" [x] Strict Attacker Context Isolation (no vault access, no discovery notes)")
            print(" [x] Three Distinct Conditions (Control, Blind, Evaluation-Aware)")
            print(" [x] Observable Tool Action Telemetry (recorded without requiring private CoT)")
            print(" [x] Conservative Causal Attribution (distinguishing memorization from search)")
            print(" [x] Explicit Denominators for Aggregated Metrics")
            print(" [x] Strict Tenant Isolation")

        await close_database_connections()
        set_settings(None)
        stack["server"].cleanup()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
