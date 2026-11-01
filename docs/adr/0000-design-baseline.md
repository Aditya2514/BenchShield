# Decision register and validation backlog
## Decisions adopted in this revision
ADR-001: exposure audits are the core product; controlled attacker tests are optional. ADR-002: maintain one central orchestrator and bounded specialists. ADR-003: keep exposure, task identity, timing, attribution and policy compliance independent. ADR-004: enforce gold isolation and outbound policy outside models. ADR-005: freeze discovery and isolate comparative experiments. ADR-006: allow policy-filtered investigation fallback but pin experiment configurations.

ADR-007: use the modular Python/FastAPI and React/TypeScript monorepo as the planning baseline. ADR-008: use PostgreSQL persistence with durable worker leases first; add Redis/Celery and vectors only when justified. ADR-009: retain TinyFish behind a controlled adapter. ADR-010: retain BenchShield only as a working codename pending independent naming validation.

These are design decisions made under the user's approval of the review refinements on 1 November 2026. They do not claim that vendor capabilities, licensing, package versions or production security have already been validated. Each implementation ADR must record context, alternatives, rationale, consequences, owner, date and validation evidence.

## Corrections to v0.1
Removed hard-coded model IDs, free-tier limits and stable-endpoint claims from the implementation baseline. They were not independently verified in this revision. The ordered multi-provider requirement is preserved through a capability-based registry. Exact candidates and ordering will be chosen using current official documentation and task-specific quality tests.

The original research percentages and asserted exact-name collision are not repeated as established facts. Before external publication, verify the cited papers, study conditions and naming claim. Product design does not depend on those prevalence figures or an assumed collision.

## Validation register before implementation
Validate TinyFish SDK signatures, API limits, pricing, data handling and permitted source access. Validate each model's exact ID, revision availability, structured-output behavior, tool support, terms and latency. Benchmark local hardware before assigning concurrent agents. Select package versions, deployment environment, authentication provider, object storage and backup/deletion windows.

Record source URL, publisher, date checked, supported claim and remaining uncertainty. Where a vendor cannot expose an immutable model revision, document that limitation. Do not treat free service access as a reliability or privacy guarantee.

## Historical context
The source is BenchShield Product and Architecture Handoff v0.1 supplied by the user. Earlier product alternatives and the premature prototype are historical context, not implementation dependencies. No prior code has been adopted. Future collaborators should use this blueprint and the decision log as planning context while following the user's current instructions.
