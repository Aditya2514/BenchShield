# BenchShield - Benchmark Exposure Audit Product

BenchShield is a benchmark exposure audit system designed to discover public copies of evaluation questions and answers, inspect evidence, assess temporal exposure independently, and produce versioned, auditable reports.

## Invariants & Principles
1. **No Opaque Scores**: Exposure type, task identity, answer match, temporal status, attribution, and policy compliance are independent dimensions.
2. **Never Mask Incomplete Audits**: A partial or interrupted audit visibly displays coverage limitations; it never says "no exposure detected".
3. **Zero Gold Leakage**: Protected/gold answers never enter browser storage (`localStorage`, `sessionStorage`, `IndexedDB`), client telemetry, or external logs.
4. **Escaped Evidence Content**: Untrusted source content is rendered strictly as plain text (no `dangerouslySetInnerHTML`).
5. **Contract-Driven**: Generated TypeScript client (`packages/api-client`) originates strictly from `docs/contracts/openapi.yaml`.

## Structure
* `docs/contracts/`: Canonical OpenAPI 3.1 specification and SSE Event JSON Schema.
* `packages/api-client/`: Generated TypeScript client (`@benchshield/api-client`).
* `apps/frontend/`: React 19 + TypeScript + Vite frontend application.
* `fixtures/`: Contract-valid synthetic scenarios based on the SYN-014 blueprint example.

## Scripts
* `npm run typecheck` - Run TypeScript check across all packages
* `npm run lint` - Run ESLint and OpenAPI contract linting
* `npm test` - Run all package unit and contract tests
* `npm run generate:client` - Regenerate API client from OpenAPI contract
* `npm run check:generated` - Verify that the generated client is in sync with the contract
* `npm run check:no-msw` - Build production bundle and verify MSW is completely excluded

