# ADR-0011: Phase B0 Contracts, Tooling, and Synthetic Fixtures

## Context
Phase B0 establishes the contract baseline, tooling foundation, validation schemas, and evaluation fixtures for BenchShield before implementing server persistence, authentication, or live integrations.

The core product requirement is auditing benchmarks for publicly exposed evaluation items while maintaining strict boundaries:
- Protected gold answers must never leak into public response models or error logs.
- Independent dimensions (exposure verification, task identity, answer agreement, temporal evidence, and policy compliance) must be preserved without collapsing into a single integrity score.
- Frontend and backend teams require a single authoritative schema source.
- Development and held-out evaluation partitions must be separated to prevent evaluation contamination.

## Decisions

### 1. Backend Tooling Selection
- Selected **Python >= 3.11** with **uv** as the package and virtual environment manager, with **hatchling** as the build backend.
- `uv` provides sub-second dependency resolution, deterministic locking via `uv.lock`, and zero-configuration tool execution (`uv run pytest`, `uv run ruff`).
- Configured **ruff** for linting and code formatting, and **pytest** (with `pytest-asyncio`) for test execution.

### 2. Single Authoritative Schema Source
- Pydantic v2 models defined in `apps/backend/src/benchshield/domain/models/` serve as the single source of truth.
- A minimal FastAPI contract application (`apps/backend/src/benchshield/api/app.py`) defines endpoint routes, status codes, query parameters, and headers.
- Placeholder endpoints explicitly return `HTTP 501 Not Implemented` and are documented as contract definitions only.
- `scripts/generate_contracts.py` automatically exports `docs/contracts/openapi.json` and SSE event JSON schemas (`docs/contracts/events/`).
- Stale contract exports are caught automatically by `tests/contract/test_contract_exports.py`.

### 3. Separation of Protected Intake and Public Response Models
- Ingestion accepts `ItemIntake` containing `gold_answer`.
- The intake service splits input atomically into public `ItemVersion` (which contains NO reference answer) and `GoldVaultRecord` (intended for isolated verifier storage).
- Benchmark import validation is atomic: any single invalid row rejects the entire batch, returning `status="rejected"`, `benchmark_version_id=None`, and structured `ImportRowError` items.
- Error messages identify row numbers and fields, but are strictly prohibited from echoing gold answer strings.

### 4. Synthetic Fixture Partitioning
- All evaluation fixtures are 100% synthetic; no real benchmark data is used.
- Fixtures are registered in `fixtures/manifest.json` with stable IDs (`FIX-DEV-*` and `FIX-HELD-*`), domain outcomes, and label rationales.
- The `held_out` partition is strictly quarantined from prompt tuning and heuristic fitting, reserved for release gate validation.

### 5. Deterministic Fake Adapters
- Defined minimal typed interfaces with usage accounting (queries, fetches, token usage, cost, latency), timeouts, and normalized error classes (`AdapterTimeoutError`, `AdapterRateLimitError`, `AdapterUnavailableError`, `AdapterContentPolicyError`).
- Provided deterministic in-memory fake adapters (`FakeSearchAdapter`, `FakeFetchAdapter`, `FakeModelReasoningAdapter`, `FakeEvidenceStorageAdapter`, `FakeGoldVaultAdapter`, `FakeTrustedGradingAdapter`) for test execution without network requests or mock external SDKs.

### 6. Typed Public Metadata and Sensitive Boundary Isolation
- An independent audit revealed that freeform `ItemIntake.metadata` copied into `ItemVersion.metadata` allowed un-allowlisted or sensitive fields (such as `metadata.gold_answer` or internal research notes) to escape into public representations.
- Replaced untyped dictionary metadata with `PublicItemMetadata`, which strictly allowlists public attributes: `domain`, `difficulty`, `tags`, `source_reference`, `license`. Configured `extra="forbid"` to reject unexpected metadata keys at ingestion.
- **Architectural Boundary Note**: Schemas alone cannot detect secrets inadvertently placed inside free-text fields (such as question prompts). Safe producer mappings and intake sanitization are strictly required.

### 7. Salted Answer Revision Binding & Immutable Version Identity
- Previously, changing reference answers preserved benchmark and item version IDs because answer checksums were excluded to prevent leaking low-entropy answers.
- Directly hashing raw low-entropy answers (e.g., single MCQ letters "B" or short numbers) into public IDs creates a trivial rainbow-table attack.
- Resolved by establishing an immutable salted answer binding:
  `answer_binding_version = abv_<hash[:16]>` where hash is computed over `benchshield:v1:answer_binding:{workspace_id}:{external_id}:{resolved_gold_text}`.
- Consequence:
  - Any reference answer change automatically produces a new `answer_binding_version` and a new `benchmark_version_id`.
  - Workspace scoping (`workspace_id`) prevents rainbow table inversion and eliminates accidental cross-tenant identifier collisions.
  - Validation is kept separate from persistence identity allocation.

### 8. Strongly-Typed SSE Telemetry Hierarchy
- Replaced arbitrary `dict[str, Any]` payload envelopes with strongly-typed payloads for all 12 operational lifecycle events (`InvestigationQueuedPayload`, `InvestigationStartedPayload`, `PhaseTransitionPayload`, `ItemInvestigationStartedPayload`, `CandidateDiscoveredPayload`, `VerificationCompletedPayload`, `BudgetUpdatedPayload`, `InvestigationCompletedPayload`, `InvestigationFailedPayload`, `InvestigationCancelledPayload`, `InvestigationBlockedPayload`, `SnapshotRefreshRequiredPayload`).
- Enforced strict payload type matching via `@model_validator` and `extra="forbid"`. Arbitrary payload dictionaries and unexpected secret fields are rejected.
- Operational progress events are kept minimal, exposing only necessary identifiers and non-sensitive metrics.
- Updated OpenAPI contract to advertise `text/event-stream` with documented SSE framing (`id:`, `event:`, `data:`, and `Last-Event-ID` reconnection cursor), rather than describing the stream as a JSON array.

### 9. Standardized HTTP Exception and Validation Contracts
- Configured custom FastAPI exception handlers for `RequestValidationError` and `StarletteHTTPException` to guarantee all error responses strictly conform to the declared `ErrorResponse` schema (eliminating Starlette's default `{"detail": ...}` format).
- Validation handlers strictly sanitize error output: raw submitted payloads, request bodies, and Pydantic `input`/`ctx` dictionaries are omitted to prevent secret reflection in error responses.

### 10. Hardened Intake Failure Modes & Limits
- Defined explicit batch row limits (`MAX_BATCH_ROWS = 10,000`), byte limits (`MAX_CONTENT_BYTES = 50 MB`), and field length limits (`MAX_EXTERNAL_ID_LENGTH = 256`, `MAX_QUESTION_LENGTH = 32,768`, `MAX_CHOICE_TEXT_LENGTH = 4,096`, `MAX_GOLD_ANSWER_LENGTH = 16,384`).
- Enforced UTF-8 / UTF-8-BOM encoding with clean rejection of invalid byte sequences.
- Bounded parser errors: non-object JSON rows, duplicate CSV headers, malformed choice JSON (without silent fallback), duplicate choice IDs/texts, and ambiguous MCQ mappings produce structured `ImportRowError` items under atomic rejection.

## Consequences
- **Positive**: Eliminates risk of secret or raw answer leakage across public item responses, telemetry streams, and HTTP error payloads.
- **Positive**: Low-entropy reference answers are cryptographically protected against rainbow-table attacks while guaranteeing version immutability and tenant isolation.
- **Positive**: Frontend and backend consumers have validated OpenAPI, event stream, and JSON Schema contracts verified via `jsonschema` Draft 2020-12.
- **Boundaries**: Operational persistence (PostgreSQL), background workers, authentication middleware, and live external providers remain strictly deferred to Phase B1+.

