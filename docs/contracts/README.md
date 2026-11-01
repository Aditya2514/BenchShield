# Data Model and Shared API Contracts

## Contract Ownership & Single Source of Truth
The backend owns the OpenAPI specification and event JSON schemas.
- **Authoritative Source**: Python Pydantic models in `apps/backend/src/benchshield/domain/models/` and the FastAPI contract application in `apps/backend/src/benchshield/api/app.py`.
- **Export Artifacts**:
  - `docs/contracts/openapi.json`: OpenAPI 3.1 specification for REST endpoints.
  - `docs/contracts/events.json`: Consolidated JSON schemas for SSE event envelopes and payloads.
  - `docs/contracts/events/*.json`: Granular per-event JSON schemas.
- **Frontend / Client Generation**: The TypeScript API client in `packages/api-client` and frontend mocks in `apps/frontend/src/mocks` must be generated directly from these exported schemas. Independent hand-maintained schema duplicates are prohibited.

## Regenerating Contracts
To regenerate contracts from the authoritative Python definitions, run from the repository root:
```bash
python scripts/generate_contracts.py
```
Or via `uv` in `apps/backend`:
```bash
cd apps/backend && uv run python ../../scripts/generate_contracts.py
```

## Detecting Stale Exports
Contract freshness is automatically validated in CI and locally via:
```bash
cd apps/backend && uv run pytest tests/contract/test_contract_exports.py
```
This test compares `openapi.json` against `app.openapi()` and fails if changes in Python models were not exported.

---

## Core Entities
- **Workspace & Membership**: Tenant isolation (`workspace_id`).
- **BenchmarkVersion & ItemVersion**: Immutable benchmark inputs. Protected gold answers are strictly excluded.
- **GoldVaultRecord**: Protected reference answers vaulted under verifier-only credentials.
- **EvaluationPolicyVersion**: Immutable audit rules, allowed source families, cutoff timestamps, and budgets.
- **Investigation**: Lifecycle orchestrator state (`queued`, `validating`, `discovering`, `verifying`, `awaiting_review`, `completed`, `failed`, `cancelled`, `policy_blocked`, `budget_exhausted`).
- **SourceSnapshot**: Immutable crawled evidence reference with SHA-256 hash, URL redirect history, and excerpt locator.
- **EvidenceClaim, VerificationResult, TemporalAssessment**: Independent finding dimensions distinguishing exposure verification, task identity, answer agreement, and timing.
- **ReviewDecision**: Append-only human adjudication records with optimistic concurrency versioning.
- **ExperimentConfig & AdversarialRun**: Optional attacker experiments with pinned conditions (`control`, `blind`, `evaluation_aware`) and observable tool trajectories.
- **ReportVersion**: Frozen versioned audit report.

---

## Endpoint Contract Summary
| Method | Endpoint | Description | Phase Status |
|---|---|---|---|
| POST | `/api/v1/benchmarks` | Atomic import of JSON benchmark items. Returns version ID or row errors without leaking gold answers. | **Operational in B1** |
| POST | `/api/v1/benchmarks/upload` | Atomic import of CSV or JSON benchmark file. Bounded size limit and zero retained temporary files. | **Operational in B1** |
| GET | `/api/v1/benchmarks/{id}` | Read parent benchmark entity and version counts. | **Operational in B1** |
| GET | `/api/v1/benchmarks/versions/{id}` | Read immutable benchmark version snapshot metadata. | **Operational in B1** |
| GET | `/api/v1/benchmarks/versions/{id}/items` | Paginated item listing strictly excluding protected gold answers. | **Operational in B1** |
| POST | `/api/v1/policies` | Create immutable evaluation policy version. Rejects confidential external discovery with HTTP 400. | **Operational in B1** |
| GET | `/api/v1/policies/{id}` | Read parent policy entity and latest version. | **Operational in B1** |
| GET | `/api/v1/policies/versions/{id}` | Read immutable policy version specification. | **Operational in B1** |
| POST | `/api/v1/investigations` | Launch audit investigation with `Idempotency-Key`. | Contract placeholder (501) in B1; orchestration in B2 |
| GET | `/api/v1/investigations/{id}` | Read investigation status, partial coverage, budget spend, and limitations. | Contract placeholder (501) in B1; worker state in B2 |
| GET | `/api/v1/investigations/{id}/events` | Authenticated SSE stream for monotonic progress telemetry. | Contract placeholder (501) in B1; SSE stream in B2 |
| POST | `/api/v1/investigations/{id}/cancel` | Idempotent cancellation request. | Contract placeholder (501) in B1; worker cancellation in B2 |
| GET | `/api/v1/investigations/{id}/findings` | Paginated findings with independent dimensions and evidence references. | Contract placeholder (501) in B1; services in B3 |
| POST | `/api/v1/findings/{id}/reviews` | Append reviewer decision with expected version (returns 409 on conflict). | Contract placeholder (501) in B1; services in B3 |
| POST | `/api/v1/investigations/{id}/experiments`| Launch pinned optional attacker experiment. | Contract placeholder (501) in B1; experiments in B4 |
| POST | `/api/v1/investigations/{id}/reports` | Create frozen report export job. | Contract placeholder (501) in B1; reporting in B3 |
| GET | `/api/v1/reports/{id}` | Get report status and authorized download reference. | Contract placeholder (501) in B1; reporting in B3 |

---

## Status Classification (Phase B0)
- **Implemented & Tested**:
  - Domain enums and Pydantic schemas.
  - Benchmark intake pure parsing and validation helpers (CSV and JSON, duplicate-ID detection, choice-text mapping, atomic rejection, answer masking).
  - State machine validators for investigation transitions, experiment transitions, and optimistic concurrency version checking.
  - Adapter interfaces and deterministic fake implementations for search, fetch, reasoning, storage, and trusted grading.
  - Synthetic evaluation fixtures and partition manifest.
  - Contract export generation script and stale export detection test suite.
- **Contract-Only (Non-Production)**:
  - `apps/backend/src/benchshield/api/app.py`: Minimal FastAPI application defining route signatures, request/response models, and status codes. Placeholder operations return HTTP 501.
- **Deferred to B1+**:
  - Live HTTP endpoints, authentication/membership middleware, database persistence (PostgreSQL), background worker processes, and gold vault storage.
- **Unresolved External Dependencies**:
  - Official TinyFish API client library verification, LLM provider live credentials, and object storage endpoints (scheduled for B2+).
