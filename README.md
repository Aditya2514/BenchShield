# BenchShield

> Automated exposure audit system for benchmark maintainers. Detects publicly accessible benchmark questions, solutions, and answers with verifiable evidence, timing analysis, and optional controlled attacker experiments.

## Status: Phase B0 Complete

Phase B0 (Contracts and Evaluation Fixtures) has been implemented and verified:
- **Executable Pydantic Schemas**: Core domain models, independent finding dimensions, intake boundaries, and event envelopes.
- **Contract Exports**: Authoritative OpenAPI 3.1 specification (`docs/contracts/openapi.json`) and SSE event JSON schemas (`docs/contracts/events/`).
- **Benchmark Intake Engine**: Pure CSV and JSON parsing, duplicate-ID detection, choice-text mapping, atomic batch validation, and strict protection of reference answers.
- **State Machine Validators**: Deterministic validation for investigation and experiment lifecycles and optimistic concurrency checks.
- **Deterministic Fake Adapters**: In-memory fake adapters for search, fetch, model reasoning, evidence storage, and trusted grading with usage accounting.
- **Synthetic Evaluation Fixtures**: 100% synthetic development and held-out partitions registered in `fixtures/manifest.json`.

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
- [ ] **Phase B1 / F1**: Secure Backend Foundation, Intake Persistence, and Vault Isolation.
- [ ] **Phase B2 / F2**: Bounded Discovery, Durable Execution, and Live Progress Telemetry.
- [ ] **Phase B3 / F3**: Verified Evidence, Finding Review, and Frozen Audit MVP.
- [ ] **Phase B4 / F4**: Optional Controlled Attacker Experiments.
- [ ] **Phase B5 / F5**: Backend Pilot Hardening and Operational Controls.
