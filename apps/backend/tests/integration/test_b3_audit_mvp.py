"""B3 end-to-end: discovery -> verification -> review -> frozen report, over real PostgreSQL."""

import json
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from benchshield.devtools.demo_scenario import DEMO_BENCHMARK, DEMO_POLICY, DemoWebAdapter
from benchshield.workers.durable_worker import DurableTaskWorker
from tests.conftest import auth_headers, make_token

GOLD = [i["gold_answer"] for i in DEMO_BENCHMARK["items"] if len(i["gold_answer"]) > 3]


async def _run_worker(db_url: str, inv_id: str) -> None:
    engine = create_async_engine(db_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    adapter = DemoWebAdapter()
    while True:
        async with factory() as s:
            w = DurableTaskWorker("w_b3", s, adapter, adapter)
            claimed = await w.claim_next_task(workspace_id="ws_alpha", investigation_id=inv_id)
            if not claimed:
                break
            await w.process_task(*claimed)
            await s.commit()
    await engine.dispose()


@pytest.mark.asyncio
async def test_b3_audit_flow(app_client: httpx.AsyncClient, real_postgres_env):
    alice = auth_headers(make_token("usr_alice", "alice@corp-alpha.com"), "ws_alpha")
    bob = auth_headers(make_token("usr_bob", "bob@corp-beta.com"), "ws_beta")
    charlie = auth_headers(make_token("usr_charlie", "charlie@corp-alpha.com"), "ws_alpha")

    bench = {**DEMO_BENCHMARK, "name": f"b3-{uuid4().hex[:6]}"}
    bmv = (await app_client.post("/api/v1/benchmarks", json=bench, headers=alice)).json()[
        "benchmark_version_id"
    ]
    pol = (await app_client.post("/api/v1/policies", json=DEMO_POLICY, headers=alice)).json()[
        "policy_version_id"
    ]
    r = await app_client.post(
        "/api/v1/investigations",
        json={"workspace_id": "ws_alpha", "benchmark_version_id": bmv, "policy_version_id": pol},
        headers=alice | {"Idempotency-Key": f"b3-{uuid4().hex}"},
    )
    inv = r.json()["investigation_id"]

    # Verification before discovery finishes is refused.
    assert (
        await app_client.post(f"/api/v1/investigations/{inv}/verify", headers=alice)
    ).status_code == 409

    await _run_worker(real_postgres_env["app_async_url"], inv)

    r = await app_client.post(f"/api/v1/investigations/{inv}/verify", headers=alice)
    assert r.status_code == 200
    assert r.json()["claim_status_counts"] == {"verified": 3, "needs_review": 1, "rejected": 1}
    r = await app_client.post(f"/api/v1/investigations/{inv}/verify", headers=alice)
    assert r.json()["findings_created"] == 0

    res = await app_client.get(f"/api/v1/investigations/{inv}/findings?size=100", headers=alice)
    body = res.json()
    assert body["total"] == 5
    assert not any(g in res.text for g in GOLD)
    by = {(f["external_id"], f["claim"]["claim_status"]): f for f in body["items"]}
    mc = by[("SYN-002", "verified")]
    assert mc["verification"]["answer_match"] == "task_specific"
    assert by[("SYN-004", "rejected")]["verification"]["task_identity"] == "different"

    rejected = await app_client.get(
        f"/api/v1/investigations/{inv}/findings?claim_status=rejected", headers=alice
    )
    assert rejected.json()["total"] == 1

    # Reviews: confirm, stale conflict, blocked confirm, role and tenant checks.
    collision = by[("SYN-003", "needs_review")]
    url = f"/api/v1/findings/{collision['finding_id']}/reviews"
    ok = await app_client.post(
        url, json={"expected_version": 1, "action": "confirm", "reason": "same Q"}, headers=alice
    )
    assert ok.status_code == 201 and ok.json()["new_version"] == 2
    stale = await app_client.post(
        url, json={"expected_version": 1, "action": "reject", "reason": "x"}, headers=alice
    )
    assert stale.status_code == 409 and stale.json()["error"] == "version_conflict"
    hist = (await app_client.get(url, headers=alice)).json()
    assert [d["action"] for d in hist["decisions"]] == ["confirm"]

    fp = by[("SYN-004", "rejected")]
    blocked = await app_client.post(
        f"/api/v1/findings/{fp['finding_id']}/reviews",
        json={"expected_version": 1, "action": "confirm", "reason": "x"},
        headers=alice,
    )
    assert blocked.status_code == 422
    assert (
        await app_client.post(
            url, json={"expected_version": 2, "action": "reject", "reason": "x"}, headers=charlie
        )
    ).status_code == 403
    assert (
        await app_client.get(f"/api/v1/findings/{mc['finding_id']}", headers=bob)
    ).status_code == 404
    assert (
        await app_client.get(f"/api/v1/investigations/{inv}/findings", headers=bob)
    ).status_code == 404

    # Frozen report.
    r = await app_client.post(
        f"/api/v1/investigations/{inv}/reports", json={"investigation_id": inv}, headers=alice
    )
    assert r.status_code == 202 and r.json()["status"] == "completed"
    rep = r.json()
    dl = await app_client.get(rep["download_url"], headers=alice)
    content = dl.json()
    assert content["summary_counts"]["verified_claims_count"] == 4
    assert content["items_with_verified_exposure"] == ["SYN-001", "SYN-002", "SYN-003"]
    assert not any(g in dl.text for g in GOLD)
    assert (await app_client.get(rep["download_url"], headers=bob)).status_code == 404

    # Later reviews do not alter the frozen report.
    await app_client.post(
        f"/api/v1/findings/{mc['finding_id']}/reviews",
        json={"expected_version": 1, "action": "reject", "reason": "changed mind"},
        headers=alice,
    )
    again = (await app_client.get(rep["download_url"], headers=alice)).json()
    assert json.dumps(again, sort_keys=True) == json.dumps(content, sort_keys=True)
    r2 = await app_client.post(
        f"/api/v1/investigations/{inv}/reports", json={"investigation_id": inv}, headers=alice
    )
    assert r2.json()["report_version"] == "R-002"
