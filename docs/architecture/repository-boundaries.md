
# Unified repository structure
The repository is a modular monorepo. The accompanying scaffold contains directories and planning documents only; application entrypoints listed below are planned files, not working implementations.

```text
benchshield/
  README.md
  docs/
    blueprint.md
    architecture/          # boundaries, data flow, state diagrams
    adr/                   # dated decisions and consequences
    contracts/             # exported OpenAPI and event schemas
    delivery/              # backend and frontend phase plans
    security/              # egress matrix and threat cases
    evaluation/            # labels, metrics, experiment protocol
  apps/
    backend/
      src/benchshield/
        api/               # routes, auth, request dependencies
        domain/            # entities and pure classification rules
        services/          # use cases and transaction boundaries
        orchestration/     # graph, states, bounded role dispatch
        agents/            # role prompts and typed contracts
        policies/          # deterministic permissions and budgets
        verification/      # task identity, graders, temporal rules
        experiments/       # pinned conditions and interventions
        providers/         # LLM registry and adapters
        web/               # TinyFish adapter and URL policy
        persistence/       # repositories and transaction support
        storage/           # vault and evidence object interfaces
        workers/           # leases, execution and cancellation
        reporting/         # immutable report assembly and export
        telemetry/         # redaction, audit and operational metrics
      migrations/
      tests/               # unit, contract, integration, security
    frontend/
      src/
        app/               # routes, providers and application shell
        features/          # domain screens detailed on next page
        components/        # reusable accessible UI
        api/               # generated client wrapper, SSE handling
        mocks/             # contract-valid synthetic scenarios
        styles/
      tests/               # components, accessibility and E2E
  packages/api-client/     # generated TypeScript client only
  fixtures/               # synthetic positives and hard negatives
  evals/                  # executable evaluation suites and results
  infra/                  # dev services and deployment definitions
  scripts/                # contract generation and validation
```


# Repository ownership and boundaries
## Backend conventions
Planned entrypoints are api/main.py and workers/main.py. Domain code must not import provider SDKs, HTTP routes or UI types. Services depend on interfaces; adapters implement provider, storage and database access. Verification owns deterministic evidence decisions and does not call web tools. Agents propose structured candidates but cannot grant permissions.

Gold storage uses a distinct runtime identity. The experiment worker can request grading through a trusted service but cannot read the answer vault. Do not place credentials, real benchmark uploads or customer snapshots in fixtures, prompts or Git.

## Frontend feature folders
Use features/benchmarks for import and validation, features/policies for scope and privacy, features/investigations for launch and progress, features/findings for claims and evidence, features/reviews for adjudication, features/experiments for optional controlled tests, and features/reports for versioned exports.

Each feature owns screens, local components, hooks and focused tests. Shared components contain presentation only. Server state stays in the API/query layer; view state stays local unless multiple screens truly need it. Never store gold answers in persistent browser state, telemetry or mock fixtures containing real data.

## Shared artifacts
docs/contracts is the reviewed contract source export; packages/api-client is generated. Contract changes update schemas, synthetic fixtures and client generation together. Backend tests validate responses; frontend mocks validate against those contracts. CI rejects stale generated clients.

Keep one dependency lockfile per ecosystem and pin tool versions during implementation setup. Development deployment should use a single Compose definition when services are introduced. Production secrets and environment-specific configuration stay outside source control.

## Testing layout
Backend tests split into unit, integration, contract and security folders. Verification fixtures include exact copies, reordered choices, common-answer collisions, ambiguous matches and temporal uncertainty. Frontend E2E tests exercise the same synthetic audit used for backend integration.

Evaluation datasets have documented train/development and held-out partitions. Prompt tuning cannot use the held-out set. Runtime outputs and downloaded evidence belong in ignored local storage or approved object storage, not committed source directories.

## Scope of scaffold
The scaffold provides the agreed folder layout, a master blueprint, separate backend/frontend delivery documents and an initial decision record. It intentionally does not contain fake server implementations, empty package manifests or placeholder tests that could be mistaken for functioning software.
