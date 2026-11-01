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
# Run all tests using uv
uv run pytest

# Run specific test suites
uv run pytest tests/unit
uv run pytest tests/contract
uv run pytest tests/security
```

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
