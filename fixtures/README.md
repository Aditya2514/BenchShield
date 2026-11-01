# BenchShield Evaluation Fixtures

This directory contains synthetic fixtures for development, contract validation, and evaluation gates.

## Partitioning & Scientific Discipline

Fixtures are strictly separated into two partitions:
1. **`development`**:
   - Used for unit, contract, and integration tests.
   - Engineering tests and prompt iterations may reference development fixtures.
2. **`held_out`**:
   - **STRICT PROHIBITION**: The held-out partition must NEVER be used for prompt tuning, heuristic matching, or parameter optimization.
   - Reserved strictly for unbiased release gate verification (e.g. M3/M5 release gates).
   - Schema validation tests do NOT claim precision or recall on held-out benchmarks.

## Structure
- `manifest.json`: Authoritative machine-readable manifest of all test cases, with stable case IDs, synthetic inputs, expected domain outcomes, and label rationales.
- `synthetic_benchmark_valid.json`: Valid synthetic benchmark JSON example for intake testing.
- `synthetic_benchmark_valid.csv`: Valid synthetic benchmark CSV example.
- `synthetic_benchmark_invalid.csv`: Negative synthetic benchmark CSV containing duplicate IDs, unsupported task types, and missing fields for testing atomic rejection.

## Synthetic Data Guarantee
All benchmark items, questions, and reference answers are 100% synthetic. No real benchmark keys or proprietary questions are committed.
