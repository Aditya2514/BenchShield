# BenchShield Backend

Core backend domain models, executable schemas, adapters, and contracts for BenchShield.

## Quick demo (no Docker, no API keys)

```bash
cd apps/backend
uv sync --all-extras
uv run python ../../scripts/demo_audit.py   # full B1->B3 audit, prints every step
uv run python ../../scripts/dev_server.py   # live API on :8000 (+ /docs), prints bearer tokens
```

Both start an embedded PostgreSQL, run migrations, seed dev users and use an offline,
scripted web (`benchshield/devtools/demo_scenario.py`). The demo walks through: exact leak,
question-only page, reordered multiple-choice options, a common-answer collision ("6"),
and an unrelated page (false positive).

## Audit flow (B3)

| Step | Endpoint | Permission |
|---|---|---|
| Verify candidates | `POST /api/v1/investigations/{id}/verify` | launch_investigation |
| List findings (filters: exposure_type, temporal_status, claim_status) | `GET /api/v1/investigations/{id}/findings` | read_investigation |
| Get finding | `GET /api/v1/findings/{id}` | read_investigation |
| Review (append-only, `expected_version`, 409 on stale) | `POST /api/v1/findings/{id}/reviews` | review_findings |
| Review history | `GET /api/v1/findings/{id}/reviews` | read_investigation |
| Freeze report | `POST /api/v1/investigations/{id}/reports` | export_reports |
| Report status / download | `GET /api/v1/reports/{id}[/download]` | export_reports |

Grader rules (`verification/grader.py`, `grader_v1.0` / `norm_v1.0`):
- Task identity first (full normalized question in source = exact; >=85% token coverage =
  equivalent; >=50% = ambiguous; else different -> rejected, answer not assessed).
- Answers: verbatim = exact; after NFKC/casefold/punctuation normalization = normalized;
  multiple choice matched on option *text* so reordered options still match.
- Answers of 3 characters or fewer are a common-answer risk and go to review.
- Unsupported task types never get an invented match.
- Timing: only commit/archive/verified-introduction times count; a page's own date is
  recorded but not trusted; a late observation stays `observed_post_cutoff`.
- Gold answers are read only via the verifier DB role, never stored on findings, and
  redacted from snapshot previews (an excerpt locator points to the exact spot).
- Confirming a finding with no available snapshot or a different task is refused (422).
- Reports are frozen JSON with a SHA-256; later reviews create no change to them.

## Setup & Verification

### Prerequisites
- Python >= 3.11 (tested on Python 3.13)
- [uv](https://docs.astral.sh/uv/) package manager

### Local Environment Setup
```bash
# Navigate to backend directory
cd apps/backend

# Create virtual environment and install dependencies including dev tools
uv sync --all-extras
```

### Running Tests
```bash
# Run all tests (unit, contract, security, and real PostgreSQL integration tests)
uv run pytest

# Run specific test suites
uv run pytest tests/unit
uv run pytest tests/contract
uv run pytest tests/security
uv run pytest tests/integration
```

### Local PostgreSQL Infrastructure & Migrations
For local Docker Compose PostgreSQL:
```bash
# Start local multi-user PostgreSQL
docker compose -f ../../infra/docker-compose.yml up -d

# Run migrations to head
uv run alembic upgrade head

# Bootstrap development test identities (Alice & Bob)
uv run python -m benchshield.persistence.bootstrap
```
*Note: The integration test suite (`tests/integration/test_b1_secure_foundation.py`) automatically spawns an isolated native embedded PostgreSQL instance, runs migrations, seeds test identities, and cleans up on teardown without requiring manual Docker startup.*

### Linting & Formatting
```bash
uv run ruff check .
uv run ruff format --check .
```

### Regenerating Contracts
From the repository root:
```bash
python scripts/generate_contracts.py
# or using uv:
cd apps/backend && uv run python ../../scripts/generate_contracts.py
```
