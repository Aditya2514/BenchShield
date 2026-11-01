"""Run a live BenchShield API for local demos / frontend work, with zero setup.

Starts an embedded PostgreSQL (migrated + seeded), a background discovery worker
using the offline demo web, and the FastAPI app on http://127.0.0.1:8000 (docs at /docs).
Prints ready-to-use bearer tokens for the seeded users.
Set TINYFISH_API_KEY in the environment to run discovery against the live web.

Run:  cd apps/backend && uv run python ../../scripts/dev_server.py [--port 8000]
"""

import argparse
import asyncio
import contextlib
import os
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "apps" / "backend" / "src"))

import uvicorn  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from benchshield.api.app import create_app  # noqa: E402
from benchshield.api.auth import create_jwt_token  # noqa: E402
from benchshield.config import Settings, set_settings  # noqa: E402
from benchshield.devtools.demo_scenario import DemoWebAdapter  # noqa: E402
from benchshield.devtools.embedded_db import start_embedded_stack  # noqa: E402
from benchshield.web.tinyfish_adapter import TinyFishAdapter  # noqa: E402
from benchshield.workers.durable_worker import DurableTaskWorker  # noqa: E402

JWT_SECRET = "dev-server-jwt-secret-key-at-least-32-bytes!"
VAULT_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
USERS = [
    ("usr_alice", "alice@corp-alpha.com", "ws_alpha", "admin"),
    ("usr_charlie", "charlie@corp-alpha.com", "ws_alpha", "viewer"),
    ("usr_bob", "bob@corp-beta.com", "ws_beta", "admin"),
]


def make_web_adapter():
    """Real web via TinyFish when TINYFISH_API_KEY is set, otherwise the offline demo web."""
    key = os.environ.get("TINYFISH_API_KEY", "").strip()
    return TinyFishAdapter(api_key=key) if key else DemoWebAdapter()


async def worker_loop(db_url: str, stop: asyncio.Event) -> None:
    engine = create_async_engine(db_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    adapter = make_web_adapter()
    while not stop.is_set():
        try:
            async with factory() as s:
                w = DurableTaskWorker("dev_worker", s, adapter, adapter)
                claimed = await w.claim_next_task()
                if claimed:
                    await w.process_task(*claimed)
                await s.commit()
            if not claimed:
                await asyncio.sleep(1.0)
        except Exception as err:  # keep the dev worker alive
            print(f"[worker] task failed: {err}")
            await asyncio.sleep(1.0)
    await engine.dispose()


async def main(port: int) -> None:
    stack = start_embedded_stack(pathlib.Path(tempfile.mkdtemp(prefix="benchshield_dev_")))
    settings = Settings(
        environment="development",
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
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    # Dev-only helper for the frontend's one-click login. Lives in this script,
    # never in create_app(), so production deployments do not have it.
    dev_tokens = [
        {
            "label": email,
            "role": role,
            "workspace_id": ws,
            "token": create_jwt_token(user_id=uid, email=email, secret=JWT_SECRET, expires_in_seconds=86400),
        }
        for uid, email, ws, role in USERS
    ]

    @app.get("/dev/session", include_in_schema=False)
    async def dev_session():
        return {"users": dev_tokens}

    print(f"\nBenchShield dev API  ->  http://127.0.0.1:{port}   (Swagger: /docs)\n")
    for uid, email, ws, role in USERS:
        tok = create_jwt_token(user_id=uid, email=email, secret=JWT_SECRET, expires_in_seconds=86400)
        print(f"{role:6} {email:24} X-Workspace-ID: {ws}\n       Authorization: Bearer {tok}\n")
    if os.environ.get("TINYFISH_API_KEY", "").strip():
        print("Discovery worker: LIVE web via TinyFish (real queries, real budget spend).\n")
    else:
        print("Discovery worker: offline demo web. Set TINYFISH_API_KEY for live discovery.\n")

    stop = asyncio.Event()
    worker = asyncio.create_task(worker_loop(stack["app_async_url"], stop))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="info"))
    try:
        await server.serve()
    finally:
        stop.set()
        with contextlib.suppress(Exception):
            await worker
        stack["server"].cleanup()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    asyncio.run(main(ap.parse_args().port))
