"""Live end-to-end audit against the real web via TinyFish.

Imports a small benchmark of real, widely republished questions (default: three GSM8K
test items), runs discovery with TinyFish, verifies, and prints findings + a report summary.
The API key is read from TINYFISH_API_KEY and never printed.

Run (from apps/backend):
  TINYFISH_API_KEY=... uv run python ../../scripts/live_audit.py
  TINYFISH_API_KEY=... uv run python ../../scripts/live_audit.py --benchmark my_items.json
  uv run python ../../scripts/live_audit.py --offline     # pipeline check, scripted web

--benchmark accepts JSON in the import format: {"name": ..., "items": [...]}.
"""

import argparse
import asyncio
import json
import os
import pathlib
import sys
import tempfile
import time
from uuid import uuid4

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "apps" / "backend" / "src"))

import httpx  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from benchshield.api.app import create_app  # noqa: E402
from benchshield.api.auth import create_jwt_token  # noqa: E402
from benchshield.config import Settings, set_settings  # noqa: E402
from benchshield.devtools.demo_scenario import DEMO_BENCHMARK, DemoWebAdapter  # noqa: E402
from benchshield.devtools.embedded_db import start_embedded_stack  # noqa: E402
from benchshield.persistence.database import close_database_connections  # noqa: E402
from benchshield.web.tinyfish_adapter import TinyFishAdapter  # noqa: E402
from benchshield.workers.durable_worker import DurableTaskWorker  # noqa: E402

JWT_SECRET = "live-audit-jwt-secret-key-at-least-32-bytes!"
VAULT_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# First three items of the public GSM8K test split (MIT licensed, widely republished).
REAL_BENCHMARK = {
    "name": "GSM8K test sample (live audit)",
    "items": [
        {
            "external_id": "gsm8k-test-0",
            "task_type": "exact_short_answer",
            "question": (
                "Janet’s ducks lay 16 eggs per day. She eats three for breakfast every "
                "morning and bakes muffins for her friends every day with four. She sells the "
                "remainder at the farmers' market daily for $2 per fresh duck egg. How much in "
                "dollars does she make every day at the farmers' market?"
            ),
            "gold_answer": "18",
            "metadata": {"domain": "math", "difficulty": "easy"},
        },
        {
            "external_id": "gsm8k-test-1",
            "task_type": "exact_short_answer",
            "question": (
                "A robe takes 2 bolts of blue fiber and half that much white fiber. "
                "How many bolts in total does it take?"
            ),
            "gold_answer": "3",
            "metadata": {"domain": "math", "difficulty": "easy"},
        },
        {
            "external_id": "gsm8k-test-2",
            "task_type": "exact_short_answer",
            "question": (
                "Josh decides to try flipping a house. He buys a house for $80,000 and then "
                "puts in $50,000 in repairs. This increased the value of the house by 150%. "
                "How much profit did he make?"
            ),
            "gold_answer": "70000",
            "metadata": {"domain": "math", "difficulty": "medium"},
        },
    ],
}

LIVE_POLICY = {
    "name": "Live public-benchmark exposure policy",
    "allowed_tools": ["search", "scrape"],
    "allowed_source_classes": ["web_search", "code_repository", "academic_archive"],
    "prohibited_answer_key_access": True,
    "benchmark_identification_permitted": False,
    "evaluation_cutoff": "2024-01-01T00:00:00Z",
    "cutoff_timezone": "UTC",
    "max_queries_per_item": 3,
    "max_fetches_per_item": 3,
    "max_concurrent_discovery_tasks": 1,
    "deadline_seconds": 900,
    "cost_ceiling_usd": 2.0,
    "data_classification": "public",
    "retention_profile": "pilot_standard_30_90",
    "reviewer_identity": "alice@corp-alpha.com",
}


class CountingAdapter:
    """Wraps an adapter to report live call outcomes (the worker swallows errors)."""

    def __init__(self, inner):
        self.inner = inner
        self.searches, self.search_errors, self.fetches, self.fetch_errors = 0, [], 0, []

    async def search(self, query, max_results=10):
        self.searches += 1
        try:
            res = await self.inner.search(query, max_results=max_results)
            print(f"    search ({len(res)} results): {query[:90]}")
            return res
        except Exception as err:
            self.search_errors.append(f"{type(err).__name__}: {err}")
            print(f"    search FAILED: {type(err).__name__}: {str(err)[:160]}")
            raise

    async def fetch(self, url, max_bytes=500_000):
        self.fetches += 1
        try:
            snap = await self.inner.fetch(url, max_bytes=max_bytes)
            print(f"    fetch ok ({snap.size_bytes} bytes): {url[:100]}")
            return snap
        except Exception as err:
            self.fetch_errors.append(f"{type(err).__name__}: {err}")
            print(f"    fetch FAILED {url[:80]}: {type(err).__name__}: {str(err)[:120]}")
            raise


def h(title: str) -> None:
    print(f"\n{'=' * 72}\n {title}\n{'=' * 72}")


async def main(args) -> int:
    key = os.environ.get("TINYFISH_API_KEY", "").strip()
    if args.offline:
        inner, bench = DemoWebAdapter(), DEMO_BENCHMARK
        print("OFFLINE mode: scripted web + synthetic benchmark (pipeline check only).")
    else:
        if not key:
            print("TINYFISH_API_KEY is not set. Set it, or use --offline.")
            return 2
        inner = TinyFishAdapter(api_key=key)
        bench = REAL_BENCHMARK
        print(f"LIVE mode: TinyFish key detected (length {len(key)}; value not shown).")
    if args.benchmark:
        bench = json.loads(pathlib.Path(args.benchmark).read_text(encoding="utf-8"))
    adapter = CountingAdapter(inner)

    h("Starting embedded PostgreSQL")
    stack = start_embedded_stack(pathlib.Path(tempfile.mkdtemp(prefix="benchshield_live_")))
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
    tok = create_jwt_token(
        user_id="usr_alice",
        email="alice@corp-alpha.com",
        secret=JWT_SECRET,
        expires_in_seconds=3600,
    )
    hdr = {"Authorization": f"Bearer {tok}", "X-Workspace-ID": "ws_alpha"}
    rc = 0
    try:
        transport = httpx.ASGITransport(app=create_app(settings))
        async with httpx.AsyncClient(transport=transport, base_url="http://live") as c:
            r = await c.post("/api/v1/benchmarks", json=bench, headers=hdr)
            imp = r.json()
            print(f"import: {r.status_code} {imp.get('status')} rows={imp.get('valid_rows')}")
            if imp.get("status") != "accepted":
                print(json.dumps(imp, indent=2))
                return 1
            pol = (await c.post("/api/v1/policies", json=LIVE_POLICY, headers=hdr)).json()
            r = await c.post(
                "/api/v1/investigations",
                json={
                    "workspace_id": "ws_alpha",
                    "benchmark_version_id": imp["benchmark_version_id"],
                    "policy_version_id": pol["policy_version_id"],
                },
                headers=hdr | {"Idempotency-Key": f"live-{uuid4().hex}"},
            )
            inv = r.json()["investigation_id"]

            h("Discovery")
            t0 = time.monotonic()
            engine = create_async_engine(stack["app_async_url"])
            factory = async_sessionmaker(engine, expire_on_commit=False)
            while True:
                async with factory() as s:
                    w = DurableTaskWorker("live_worker", s, adapter, adapter, lease_seconds=300)
                    claimed = await w.claim_next_task(workspace_id="ws_alpha", investigation_id=inv)
                    if not claimed:
                        break
                    print(f"  item {claimed[0].item_index}:")
                    await w.process_task(*claimed)
                    await s.commit()
            await engine.dispose()
            st = (await c.get(f"/api/v1/investigations/{inv}", headers=hdr)).json()
            print(
                f"\n  {time.monotonic() - t0:.1f}s  status={st['status']}  "
                f"candidates={st['findings_count']}  searches={adapter.searches} "
                f"(failed {len(adapter.search_errors)})  fetches={adapter.fetches} "
                f"(failed {len(adapter.fetch_errors)})"
            )

            h("Verification")
            v = (await c.post(f"/api/v1/investigations/{inv}/verify", headers=hdr)).json()
            print(f"  {v.get('claim_status_counts')}")
            fs = (
                await c.get(f"/api/v1/investigations/{inv}/findings?size=100", headers=hdr)
            ).json()
            for f in fs.get("items", []):
                ver = f["verification"]
                print(
                    f"  {f['external_id']:14} {f['claim']['claim_status']:13} "
                    f"{f['claim']['exposure_type']:17} id={ver['task_identity']:10} "
                    f"ans={ver['answer_match']:14} {f['snapshot']['source_url'][:70]}"
                )

            h("Report")
            rep = (
                await c.post(
                    f"/api/v1/investigations/{inv}/reports",
                    json={"investigation_id": inv},
                    headers=hdr,
                )
            ).json()
            dl = (await c.get(rep["download_url"], headers=hdr)).json()
            print(f"  {rep['report_version']} {json.dumps(dl['summary_counts'])}")
            for cv in dl.get("coverage", []):
                print(f"  coverage {cv['external_id']:16} sources={cv['sources_retrieved']}")
            for lim in dl["limitations"]:
                print(f"  - {lim}")
            starved = [
                cv["external_id"] for cv in dl.get("coverage", []) if not cv["sources_retrieved"]
            ]

            h("Verdict")
            if adapter.searches and len(adapter.search_errors) == adapter.searches:
                print(
                    "  FAIL: every search errored -> key, quota or network problem (see errors above)."
                )
                rc = 1
            elif st["findings_count"] == 0:
                print(
                    "  WARN: searches ran but no page was fetched/kept. Check fetch errors above."
                )
            elif starved:
                print(f"  WARN: pipeline ran, but no sources retrieved for: {', '.join(starved)}")
            else:
                print("  OK: discovery, verification and reporting all ran for every item.")
    finally:
        await close_database_connections()
        stack["server"].cleanup()
    return rc


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="scripted web, no API key needed")
    ap.add_argument("--benchmark", help="path to a JSON benchmark in import format")
    sys.exit(asyncio.run(main(ap.parse_args())))
