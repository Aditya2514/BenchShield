# BenchShield

> Automated exposure audit system for benchmark maintainers. Detects publicly accessible benchmark questions, solutions, and answers with verifiable evidence, timing analysis, and optional controlled attacker experiments.

## Run the full stack (backend + frontend)

```bash
cd apps/backend && uv sync --all-extras && uv run python ../../scripts/dev_server.py
```

```bash
npm install && npm run dev --workspace=apps/frontend
```

Open http://localhost:5173 and click one of the dev users to sign in. Vite proxies `/api` to the backend on port 8000. The dev server's discovery worker uses an offline demo web, so the default benchmark produces real findings.

Flow: **Benchmarks** (upload) → **Policies** → **Investigations** (launch, live event stream, then *Run Verification*) → **Findings** (inspect evidence, append-only reviews) → **Reports** (freeze, authorized download). Experiments show "not available" because the backend returns 501 until phase B4.

Demo mode without a backend: set `VITE_ENABLE_MSW=true` in `apps/frontend/.env`. The mock API serves `fixtures/scenarios`, which were captured from the real backend and are validated against `docs/contracts/openapi.json` by `packages/api-client` tests.

The frontend's TypeScript client is generated from the backend's `docs/contracts/openapi.json` (`npm run generate:client`).

## Status: Phase B1 Complete

Phase B1 (Secure Backend Foundation) has been implemented and verified:
- **Opaque Answer Revision Identity**: Replaced public answer-derived identifiers with opaque random revision IDs (`anr_<uuid4_hex[:16]>`), preventing candidate answer enumeration attacks.
- **Multi-Schema PostgreSQL Persistence**: 10 core tables across `public` and `vault` schemas with tenant-scoped composite foreign keys enforcing strict workspace boundaries.
- **Restricted Vault Boundary & AES-256-GCM**: Reference answers encrypted at rest with versioned keys; application runtime (`benchshield_app`) has INSERT-only access with SELECT strictly revoked; trusted verifier (`benchshield_verifier`) reads answers via `TrustedVaultReader`.
- **Signed JWT Authentication & Server-Side Authorization**: Real HMAC-SHA256 token verification, server-side workspace membership checks in PostgreSQL, and an explicit role/permission matrix (`viewer`, `operator`, `evaluator`, `admin`).
- **Operational Intake & Bounded Retrieval**: Atomic CSV/JSON imports (`POST /api/v1/benchmarks` and `POST /api/v1/benchmarks/upload`), idempotency handling with conflict detection, bounded pagination, and immutable evaluation policy management (`POST /api/v1/policies`).
- **Real Database Integration Test Suite**: 58 automated tests passing across unit, contract, security, and native embedded PostgreSQL integration suites (zero SQLite substitutions).

---

## Repository Structure

```text
benchshield/
  README.md
  docs/
    blueprint.md                 # Product and delivery blueprint (v0.3)
    adr/                         # Architecture decision records
    contracts/                   # Authoritative OpenAPI and event schemas
    delivery/                    # Phased delivery plans (backend & frontend)
    security/                    # Privacy boundaries and egress controls
    evaluation/                  # Experiment protocol and metric definitions
  apps/
    backend/                     # Python backend package (FastAPI, Pydantic, uv)
      src/benchshield/           # Domain models, services, providers, verification
      tests/                     # Unit, contract, and security regression suites
    frontend/                    # Frontend React application (planned for F0+)
  fixtures/                      # Synthetic evaluation fixtures and manifest
  scripts/                       # Contract generation and validation tooling
```

---

## Local Setup & Verification

### Prerequisites
- Python >= 3.11 (tested on Python 3.13)
- [uv](https://docs.astral.sh/uv/) package manager

### 1. Install Dependencies
```bash
cd apps/backend
uv sync --all-extras
```

### 2. Run Test Suites
```bash
# Run all tests (unit, contract, security)
uv run pytest

# Run specific suites
uv run pytest tests/unit
uv run pytest tests/contract
uv run pytest tests/security
```

### 3. Linting & Code Quality
```bash
uv run ruff check .
uv run ruff format --check .
```

### 4. Regenerating & Checking Contracts
```bash
# Regenerate OpenAPI and event schemas
python scripts/generate_contracts.py

# Verify exports are not stale
cd apps/backend && uv run pytest tests/contract/test_contract_exports.py
```

---

## Delivery Roadmap
- [x] **Phase B0 / F0**: Contracts, Schemas, Evaluation Fixtures, and Mocks.
- [x] **Phase B1 / F1**: Secure Backend Foundation, Intake Persistence, and Vault Isolation.
- [ ] **Phase B2 / F2**: Bounded Discovery, Durable Execution, and Live Progress Telemetry.
- [ ] **Phase B3 / F3**: Verified Evidence, Finding Review, and Frozen Audit MVP.
- [ ] **Phase B4 / F4**: Optional Controlled Attacker Experiments.
- [ ] **Phase B5 / F5**: Backend Pilot Hardening and Operational Controls.
