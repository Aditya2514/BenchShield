# BenchShield Backend

Core backend domain models, executable schemas, adapters, and contracts for BenchShield.

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
