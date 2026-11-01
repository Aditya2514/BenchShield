"""BenchShield end-to-end audit demo (B1 -> B2 -> B3), fully offline.

Starts an embedded PostgreSQL, applies migrations, then drives the real HTTP API:
import benchmark -> create policy -> launch investigation -> run discovery worker
-> verify candidates -> review findings -> freeze + download report.

Run:  cd apps/backend && uv run python ../../scripts/demo_audit.py
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
    header("0. Starting embedded PostgreSQL + migrations")
    stack = start_embedded_stack(pathlib.Path(tempfile.mkdtemp(prefix="benchshield_demo_")))
    settings = Settings(
        environment="test",
        database_url=stack["app_async_url"],
        database_owner_sync_url=stack["owner_sync_url"],
        database_verifier_url=stack["verifier_async_url"],
        vault_encryption_key=VAULT_KEY,
        vault_key_version="v1",
        jwt_secret=JWT_SECRET,
        allow_insecure_auth_shortcuts=False,
    )
    set_settings(settings)
    app = create_app(settings)
    alice = headers("usr_alice", "alice@corp-alpha.com", "ws_alpha")
    bob = headers("usr_bob", "bob@corp-beta.com", "ws_beta")
    charlie = headers("usr_charlie", "charlie@corp-alpha.com", "ws_alpha")
    gold_values = [i["gold_answer"] for i in DEMO_BENCHMARK["items"] if len(i["gold_answer"]) > 3]
    ok = True

    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://demo"
        ) as c:
            header("1. Import benchmark (gold answers go to the encrypted vault)")
            r = await c.post("/api/v1/benchmarks", json=DEMO_BENCHMARK, headers=alice)
            imp = r.json()
            print(
                f"  {r.status_code} status={imp['status']} rows={imp['valid_rows']}/{imp['total_rows']}"
            )
            bmv = imp["benchmark_version_id"]
            items = (await c.get(f"/api/v1/benchmarks/versions/{bmv}/items", headers=alice)).text
            leaked = [g for g in gold_values if g in items]
            print(f"  item listing contains gold answers: {bool(leaked)}")
            ok &= not leaked

            header("2. Create immutable policy + launch investigation")
            r = await c.post("/api/v1/policies", json=DEMO_POLICY, headers=alice)
            pol = r.json()["policy_version_id"]
            r = await c.post(
                "/api/v1/investigations",
                json={
                    "workspace_id": "ws_alpha",
                    "benchmark_version_id": bmv,
                    "policy_version_id": pol,
                },
                headers=alice | {"Idempotency-Key": f"demo-{uuid4().hex[:8]}"},
            )
            inv = r.json()["investigation_id"]
            print(f"  {r.status_code} investigation={inv} status={r.json()['status']}")

            header("3. Discovery worker (leases, fencing tokens, budgets) over the fake web")
            adapter = DemoWebAdapter()
            n = await run_discovery(stack["app_async_url"], inv, adapter)
            st = (await c.get(f"/api/v1/investigations/{inv}", headers=alice)).json()
            print(f"  tasks processed={n} status={st['status']} candidates={st['findings_count']}")
            for q in adapter.search_calls:
                print(f"    query: {q}")

            header("4. Verify candidates (task identity -> answer match -> timing)")
            r = await c.post(f"/api/v1/investigations/{inv}/verify", headers=alice)
            print(f"  {r.status_code} {json.dumps(r.json())}")
            r2 = await c.post(f"/api/v1/investigations/{inv}/verify", headers=alice)
            print(f"  re-run is idempotent: findings_created={r2.json()['findings_created']}")
            ok &= r2.json()["findings_created"] == 0

            findings = (
                await c.get(f"/api/v1/investigations/{inv}/findings?size=100", headers=alice)
            ).json()
            print(
                f"\n  {'item':8} {'claim':13} {'exposure':17} {'identity':10} {'answer':14} timing"
            )
            for f in findings["items"]:
                v = f["verification"]
                print(
                    f"  {f['external_id']:8} {f['claim']['claim_status']:13} {f['claim']['exposure_type']:17} "
                    f"{v['task_identity']:10} {v['answer_match']:14} {f['temporal']['temporal_status']}"
                )
                print(f"           -> {f['claim']['rationale']}")
            body = json.dumps(findings)
            ok &= not any(g in body for g in gold_values)
            print(
                f"\n  findings payload contains gold answers: {any(g in body for g in gold_values)}"
            )

            header("5. Human review: append-only, optimistic concurrency")
            by = {}
            for f in findings["items"]:
                by.setdefault((f["external_id"], f["claim"]["claim_status"]), f)
            collision = by.get(("SYN-003", "needs_review"))
            false_pos = by.get(("SYN-004", "rejected"))
            leak = by.get(("SYN-001", "verified"))
            if collision:
                r = await c.post(
                    f"/api/v1/findings/{collision['finding_id']}/reviews",
                    json={
                        "expected_version": 1,
                        "action": "confirm",
                        "reason": "Same question and answer on the page; not a coincidental '6'.",
                    },
                    headers=alice,
                )
                print(
                    f"  confirm SYN-003 (common-answer case): {r.status_code} v{r.json()['new_version']}"
                )
                r = await c.post(
                    f"/api/v1/findings/{collision['finding_id']}/reviews",
                    json={"expected_version": 1, "action": "reject", "reason": "stale tab"},
                    headers=alice,
                )
                print(f"  stale write with expected_version=1: {r.status_code} {r.json()['error']}")
                ok &= r.status_code == 409
            if false_pos:
                r = await c.post(
                    f"/api/v1/findings/{false_pos['finding_id']}/reviews",
                    json={"expected_version": 1, "action": "confirm", "reason": "try"},
                    headers=alice,
                )
                print(
                    f"  confirm unrelated page (SYN-004): {r.status_code} (blocked: evidence missing)"
                )
                ok &= r.status_code == 422
            if leak:
                r = await c.post(
                    f"/api/v1/findings/{leak['finding_id']}/reviews",
                    json={
                        "expected_version": 1,
                        "action": "confirm",
                        "reason": "Verbatim Q+A in public repo.",
                    },
                    headers=charlie,
                )
                print(f"  viewer role tries to review: {r.status_code}")
                r = await c.get(f"/api/v1/findings/{leak['finding_id']}", headers=bob)
                print(f"  other workspace reads finding: {r.status_code}")
                ok &= r.status_code == 404

            header("6. Freeze report + authorized download")
            r = await c.post(
                f"/api/v1/investigations/{inv}/reports",
                json={"investigation_id": inv},
                headers=alice,
            )
            rep = r.json()
            print(f"  {r.status_code} {rep['report_version']} status={rep['status']}")
            dl = (await c.get(rep["download_url"], headers=alice)).json()
            print(f"  summary: {json.dumps(dl['summary_counts'])}")
            print(f"  exposed items: {dl['items_with_verified_exposure']}")
            for lim in dl["limitations"]:
                print(f"  limitation: {lim}")
            print(f"  sha256={dl['content_sha256'][:16]}...")
            ok &= not any(g in json.dumps(dl) for g in gold_values)
            r = await c.get(rep["download_url"], headers=bob)
            print(f"  other workspace downloads report: {r.status_code}")

            events = (await c.get(f"/api/v1/investigations/{inv}/events", headers=alice)).text
            print(
                f"\n  SSE events recorded: {events.count('event: ')} "
                f"(verification_completed: {events.count('event: verification_completed')})"
            )
    finally:
        await close_database_connections()
        stack["server"].cleanup()

    header("RESULT: " + ("all demo checks passed" if ok else "SOME CHECKS FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
