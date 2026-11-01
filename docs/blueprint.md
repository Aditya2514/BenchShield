# BenchShield product and delivery blueprint
Version 0.2 | 1 November 2026 | Working codename

This blueprint defines a benchmark exposure audit product, its trust boundaries, a unified repository structure, and separate backend and frontend delivery phases. It supersedes v0.1 for project planning. The approved review refinements are incorporated; implementation has not started.

The first release helps benchmark maintainers discover public copies of evaluation questions and answers, inspect evidence, and decide what to do. Controlled attacker tests are optional and separately reported. An exposure finding remains useful when no attacker test has run.

## Product decision
Primary user: a benchmark maintainer conducting a preflight or retrospective audit. The central workflow is upload, configure policy and cutoff, investigate, verify evidence, review findings, optionally test exploitation, and export a versioned report.

The product cannot certify a benchmark as contamination-free, prove pretraining exposure, infer historical availability from today's search results, or automatically invalidate published scores. A correct answer or an accuracy gain alone does not prove prohibited retrieval.

## First release scope
Support public or synthetic, text-only benchmarks with exact short-answer and multiple-choice grading. Accept CSV and JSON through a versioned import schema. Support local exact and normalized matching, source-linked evidence, uncertain temporal assessments, human review, and one pinned attacker model configuration.

Defer arbitrary code execution, image/audio questions, broad rubric-based grading, continuous monitoring, production confidential web scanning, and automatic benchmark mutation. Semantic similarity may nominate candidates but cannot independently confirm a leak.

## Reading map
Pages 2 to 7 define policy, findings, evidence, experiments, architecture, and contracts. Pages 8 and 9 define the repository. Pages 10 and 11 contain separate delivery tracks. Page 12 joins the tracks and defines release gates. Page 13 records decisions and validation obligations. Page 14 gives a worked example.

## Success outcome
A maintainer can reproduce why an item was flagged, distinguish verified exposure from an untested exploitation hypothesis, see timing limitations, reject an incorrect match, and export the exact reviewed report version.

---
# Evaluation policy and privacy boundaries
## Evaluation policy is a required input
Every audit stores an immutable policy version: allowed tools and source classes, prohibited answer-key access, whether benchmark identification is permitted, evaluation cutoff and timezone, item scope, budgets, data classification, retention profile, and reviewer identity. The same retrieval can be legitimate in one benchmark and prohibited in another.

For retrospective audits without the original evaluation policy, report policy compliance as unknown. Never label a run a violation merely because a public answer exists.

## Outbound data rules
- Protected gold answers and grading rubrics: trusted verifier only; no search, hosted reasoning, attacker prompts, or external telemetry.
- Public questions: approved search and model providers only, with the policy version recorded.
- Confidential questions and unique fragments: local processing by default. External release requires an explicitly approved descriptor and destination policy. A local model does not make a web query private.
- Search descriptors: retain provenance to input fields and record the release decision. Redaction alone is not a guarantee against identification.
- Retrieved public answer keys: may be encountered by investigators and attackers through permitted web tools; they are never supplied from the protected gold vault.
- Embeddings, caches, checkpoints and reports: inherit the classification of their inputs. Enforce tenant boundaries and deletion rules.
- Logs and telemetry: identifiers and operational metrics by default; no raw questions, answers, prompts, excerpts, secrets or signed object URLs in external traces.

## Enforcement
Use a non-LLM policy gate on every provider and tool call. Validate destinations and redirects, deny private/link-local network targets, enforce content and archive expansion limits, and block arbitrary downloaded-code execution. Treat retrieved instructions as data. Investigators cannot acquire new permissions through page content.

Keep the gold store behind verifier-specific credentials. The API, investigators and attacker workers must not receive direct gold-table access. Tenant authorization applies to database queries, object access, exports, job execution and progress events.

## Confidential mode
The initial design supports local matching against an approved corpus. Confidential external discovery is deferred until descriptor release controls, provider contracts and security review are complete. If no approved route exists, return policy_blocked rather than silently reducing protection.

---
# Findings and temporal classification
## Independent dimensions
Replace a single severity ladder with a structured finding. Exposure types are independent: metadata, question context, worked solution and reference answer. Each claim has candidate, verified, rejected or needs_review status. A verified solution need not reproduce the question verbatim.

Record task_identity as exact, equivalent, ambiguous or different. Record answer_match separately as exact, normalized, task_specific, mismatch or not_applicable. A common number or matching answer letter is insufficient without task correspondence. Multiple-choice comparisons must account for reordered options; numerical tasks must preserve units and inputs.

## Experiment result fields
- Run status: not_requested, queued, running, completed, failed, cancelled, policy_blocked or budget_exhausted.
- Source discovered: yes, no or unknown.
- Answer-bearing content retrieved: yes, no or unknown.
- Grader outcome: correct, incorrect, unsupported or error.
- Attribution: none, retrieval_observed, use_supported or intervention_supported.
- Policy compliance: permitted, violated or unknown, with the applicable rule and evidence.

A completed run with no exploitation observed is distinct from a failed run or an untested item. Preserve partial trajectories without presenting partial execution as completion.

## Temporal evidence
Store retrieval time, asserted publication time, commit time, archive capture time and verified introduction time separately. Each assertion points to the exact content version or snapshot and its supporting evidence. Repository dates and signed tags do not alone prove historical public accessibility.

Use temporal statuses: verified_pre_cutoff, observed_post_cutoff, verified_introduced_post_cutoff and unknown. A later observation does not prove absence of earlier copies. Post-cutoff introduction claims apply to the specific source/version, not the whole internet.

## Report language
Examples: Verified answer exposure; timing unknown. Verified pre-cutoff solution exposure; attacker test not requested. Prohibited retrieval observed in a completed run; answer incorrect. No matching evidence found within the recorded search scope. Investigation incomplete due to provider outage.

Do not downgrade verified exposure to potential merely because timing is unknown. Avoid an opaque integrity score. Explain evidence strength, policy relevance, temporal support and experimental limitations independently.

---
# Evidence pipeline and reviewer workflow
## Investigation pipeline
Validate upload and item IDs; classify inputs; split protected answers from releasable fields; create bounded search hypotheses; search approved source families; fetch candidates; preserve evidence; normalize content; verify task identity and answer agreement; assess timing; assemble findings for review.

One central orchestrator owns state, policy and budgets. Logical specialists cover profiling, query planning, repository investigation, research investigation, conditional mirror discovery and evidence analysis. Deterministic services own validation, permission checks, exact grading, hashes and classification rules.

Escalate from Search to Fetch to a bounded web Agent only when necessary. Browser control is a later exception. Gold-derived phrases must never enter search queries. Cache within the tenant and policy boundary; investigator caches must not seed attacker sessions.

## Evidence record
Preserve source URL, redirect chain, final URL, retrieval time, source family, content hash, raw permitted snapshot, extraction version, excerpt locator, media type and access limitations. Store interpretations separately with model/configuration identity. Hashes detect changes; they do not establish publication date or truth.

Link each verification to benchmark version, item version, answer-vault reference, normalization version, grader version and evidence snapshot. Deduplicate source URLs without collapsing distinct historical content versions. Handle inaccessible sources as coverage limitations.

## Review and remediation
A reviewer can confirm, reject or request more evidence, recording a reason. Corrections append a new decision rather than overwriting the original evidence. New exports capture a frozen report version, reviewer decisions, unresolved claims and scope limitations.

Recommended actions depend on evidence and benchmark policy: investigate a mirror, rotate an exposed item, restrict a source during future evaluations, revise permitted-tool rules, or qualify a result. Never automatically contact site owners, remove content or revise published scores.

## Retention proposal
For the pilot, propose 30-day raw snapshot retention and 90-day report/metadata retention, configurable before the audit starts. Expired evidence is labelled unavailable; reproducibility claims must reflect that. Deletion revokes access promptly and schedules removal from caches, objects and backups under a documented deletion window. Retention periods are operational defaults pending deployment review.

---
# Controlled attacker experiments
## Conditions
Control: question only, no web. Blind: question plus permitted browsing, without supplied benchmark identity. Evaluation-aware: the same browsing setup plus explicit benchmark-identification instructions. The blind condition may infer identity from the question; blind describes what the system supplies, not guaranteed ignorance.

Freeze the discovery version before tests. Neither attacker receives discovery findings, protected answers or investigator cache contents. Use fresh sessions, isolated storage and an allowlisted tool layer. Grade only after the run.

## Comparability and fallback
Pin provider, exact model identifier and available revision, prompt version, generation settings, tool policy, reasoning budget, item versions and grader. Record unavailable revision metadata as a reproducibility limitation. For paired browsing conditions, vary only the intended instruction difference. Control has no web budget by definition; record that difference explicitly.

Investigation tasks may use an ordered, privacy-filtered provider fallback. Comparative experiments must not silently switch providers or models. An outage produces an incomplete run or a new separately labelled experiment configuration. Never pool results across changed configurations without stratification.

## Attribution strength
An observed source retrieval establishes access. A matching answer and aligned trajectory can support use but do not establish the counterfactual effect. Where feasible, repeat under answer-bearing-source blocking or controlled answer redaction. Predefine the intervention and preserve legitimate information where possible; domain-wide blocking can remove useful non-leaked information and is a confound.

Repeat paired conditions with a fixed schedule and record run order to reduce time-dependent web effects. Use controlled fixtures for causal validation; live-web results retain uncertainty. Do not require or expose private model reasoning; record observable tool calls, content and outputs.

## Metrics
Report verified exposure precision, fixture recall, false-positive rate, temporal support coverage, completed-run rate, prohibited retrieval rate and correct-answer rate separately. Define every denominator and exclude incomplete runs from success-rate denominators while reporting their count.

For small samples show counts and uncertainty; never generalize a curated demo to all benchmarks. Real-web recall is unknown without a complete ground truth. Record cost, latency, source-family coverage and policy-blocked calls alongside scientific outcomes.

---
# Backend architecture and reliability
## Recommended baseline
Use a modular Python backend with FastAPI, Pydantic schemas, PostgreSQL and a separate worker process. LangGraph is the selected planning baseline for central workflow state; one orchestrator owns transitions. React with TypeScript and Vite is the frontend baseline. Exact package versions require verification and pinning during setup.

For the first deployable pilot, use a PostgreSQL-backed job table with leases and idempotency. Add Celery/Redis only when load, scheduling or operational needs justify it. Do not operate two independent retry/state machines. Object storage holds evidence and exports; an encrypted local adapter may serve development. Defer pgvector until retrieval evaluations demonstrate a need.

## State and recovery
Investigation states: queued, validating, discovering, verifying, awaiting_review, completed, failed, cancelled, policy_blocked and budget_exhausted. Partial coverage is an explicit field, not an implied success state. Optional experiments have independent states and cannot rewrite the frozen discovery result.

Persist a task dispatch and state transition transactionally with an outbox event. Workers use leases, heartbeat and recovery after expiry. Assume at-least-once delivery: deduplicate writes by task and attempt identity, and use provider idempotency keys where supported. Exactly-once external execution is not promised.

Before dispatch, reserve budget atomically across parallel branches. Reconcile actual usage and conservatively retain unknown charges. Bound attempts, deadlines, concurrency and response sizes. Cancellation prevents new dispatch, signals active tasks and records any late results without reviving a cancelled run.

## Provider and web adapters
Interfaces expose capabilities, classification support, structured output, timeout, usage and error categories. Candidate eligibility is filtered before ordering. Rate limits and transient failures receive bounded retry with backoff; invalid output gets limited repair. Low confidence routes to review, not undisclosed model shopping.

TinyFish remains the intended web adapter, subject to official API and terms validation. Do not encode unverified method names, free-tier assumptions or model IDs into the blueprint. Provider credentials live outside prompts and repository files.

## Operational controls
Measure queue age, worker failure, incomplete runs, spend and provider errors. Redact content from traces. Test backup restoration and tenant isolation before hosting real customer data. Separate investigator and attacker runtime identities, even when they share application code.

---
# Data model and shared API contracts
## Core entities
Workspace and Membership define tenant access. BenchmarkVersion and ItemVersion identify immutable inputs. GoldReference points to the protected vault. EvaluationPolicyVersion captures rules and privacy. Investigation, Hypothesis and TaskAttempt capture orchestration. SearchExecution and SourceSnapshot capture discovery. EvidenceClaim, VerificationResult and TemporalAssessment capture independent facts. ExperimentConfig, AdversarialRun and Intervention capture tests. ReviewDecision, ReportVersion and AuditEvent preserve decisions and provenance.

All owned records carry workspace_id and authorization checks. Source snapshots include extraction and content versions. Reports refer to frozen record versions rather than mutable current rows. Deletion and retention preserve audit metadata only where the approved policy permits it.

## API proposal
- POST /api/v1/benchmarks: validated CSV/JSON import; returns IDs and row errors, never gold answers.
- POST /api/v1/policies: create an immutable policy version.
- POST /api/v1/investigations: validate policy and budget; return 202 with investigation ID. Require Idempotency-Key.
- GET /api/v1/investigations/{id}: state, partial coverage, counts, budget and limitations.
- GET /api/v1/investigations/{id}/events: authenticated SSE with monotonic event IDs and reconnect cursor.
- POST /api/v1/investigations/{id}/cancel: idempotent cancellation request.
- GET /api/v1/investigations/{id}/findings: paginated independent dimensions and evidence references.
- POST /api/v1/findings/{id}/reviews: append review decision with expected version; stale writes return conflict.
- POST /api/v1/investigations/{id}/experiments: create pinned optional experiment after validation.
- POST /api/v1/investigations/{id}/reports: freeze report inputs and create export job.
- GET /api/v1/reports/{id}: status and authorized download reference.

## Contract ownership
Backend owns OpenAPI and event JSON schemas. Generate the TypeScript client from those contracts; do not hand-maintain duplicate types. Frontend mocks use checked-in synthetic fixtures validated against the same schemas. Version error codes and event envelopes with event_id, entity_id, type, schema_version and time.

Use consistent errors: validation_failed, policy_blocked, budget_exhausted, provider_unavailable, unsupported_grader, not_found and version_conflict. Object downloads require fresh authorization. SSE reconnects replay a bounded event history; an expired cursor instructs the client to refresh the state snapshot.

---
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

---
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

---
# Backend delivery phases
## B0 Contracts and fixtures
Deliver the upload schema, evaluation policy, finding dimensions, event envelopes, state diagram and synthetic labelled corpus. Define fixtures before integrating providers. Dependency: approved v0.2 blueprint. Exit: schemas validate positive and negative examples; frontend can consume fixtures without backend availability.

## B1 Secure foundation
Implement API bootstrapping, migrations, workspace membership, immutable benchmark/item versions, upload validation and protected gold storage. Add authorization and redacted audit events. Dependency: B0. Exit: malformed imports produce row errors; cross-tenant access is denied at API, repository and object boundaries; no gold fields appear in API responses or logs.

## B2 Bounded discovery
Implement policy gate, provider registry, TinyFish adapter, central orchestrator, durable worker leases, budget reservations, cancellation and progress events. Start with repository and research roles; invoke mirror discovery only with a bounded reason. Dependency: B1 and validated provider access. Exit: one synthetic audit completes; injected outage, retry, cancellation and worker restart preserve state and budget accounting.

## B3 Evidence and audit MVP
Implement immutable snapshots, exact/task-specific verification, temporal assessments, independent findings, review decisions and versioned report export. Dependency: B2. Exit: held-out matching gates pass; an exported finding resolves to its source snapshot, rule versions and reviewer action. This phase delivers a useful audit without attacker tests.

## B4 Optional experiments
Implement control, blind and evaluation-aware conditions with isolated sessions, pinned configurations, trusted grading and observable trajectories. Add a controlled intervention fixture and incomplete-run handling. Dependency: B3. Exit: discovery evidence never enters attacker context; outage never changes model silently; metrics use explicit denominators and report incomplete runs.

## B5 Pilot hardening
Implement retention/deletion, restore exercises, rate limits, load checks, dependency scanning and deployment runbooks. Dependency: B3 for audit-only pilot or B4 for experiments. Exit: all security and release gates pass; operator can restore data, cancel stalled work and explain partial results.

## Deferred backend work
Continuous monitoring, vector retrieval, large-scale queue infrastructure, confidential external discovery, arbitrary-code sandboxes and additional task graders require separate evidence of value and ADRs. Do not let them block the first audit MVP.

---
# Frontend delivery phases
## F0 Contract-driven UX
Define navigation, wireframes, accessible status vocabulary and contract-valid mocks for successful, partial, blocked and failed audits. Dependency: B0 schema draft. Exit: a reviewer can walk through upload, audit, evidence review and export using mocks; no screen relies on an opaque score.

## F1 Shell and benchmark setup
Build application shell, workspace context, import flow, row validation display and policy configuration. Show supported task types, cutoff timezone, outbound destinations and budget before launch. Dependency: F0; live integration requires B1. Exit: import errors are actionable, keyboard navigation works, and gold data is not persisted or sent to analytics.

## F2 Investigation operations
Build launch, progress timeline, budget usage, partial-coverage warnings, reconnect behavior and cancellation. Dependency: F1 plus B2 contracts; mocks allow parallel work. Exit: refresh and SSE reconnect recover current state; duplicate events do not duplicate UI rows; a failed source fetch does not appear as a clean result.

## F3 Evidence review and audit MVP
Build findings filters, source excerpt viewer, task-identity and answer-match panels, temporal evidence, reviewer actions and report history. Render source content as escaped or sanitized data, never executable HTML. Dependency: F2 and B3. Exit: users can inspect evidence, reject a false positive, handle a version conflict and export a reviewed report. Untested exploitation and unknown timing remain visible.

## F4 Optional experiments
Build explicit experiment setup, pinned configuration summary, condition comparison and observable trajectory viewer. Show counts, denominators, incomplete runs and attribution strength. Dependency: F3 and B4. Exit: the UI cannot suggest that a correct answer proves exploitation; changed model configurations are displayed as separate groups.

## F5 Pilot usability and resilience
Complete responsive layouts, keyboard/focus checks, contrast checks, loading/error/empty states, session expiry, authorized downloads and end-to-end tests. Dependency: F3 for audit pilot or F4 for experiments. Exit: representative maintainers complete a review unaided; critical paths meet accessibility checks and all defined error scenarios remain usable.

## Frontend guardrails
Avoid displaying implementation details unless they affect a user decision. Show model identity in experiment methodology, not in every status message. Never display no exposure detected for an incomplete audit. Distinguish a report generation failure from an investigation failure.

---
# Integration milestones and acceptance gates
## Dependency sequence
M0: B0 + F0 establish schemas and fixtures. M1: B1 + F1 enable validated intake. M2: B2 + F2 enable a bounded investigation. M3: B3 + F3 deliver the audit MVP. M4: B4 + F4 add optional experiments. M5: B5 + F5 qualify the selected pilot scope.

Frontend can progress with validated mocks after M0, but no milestone is complete until its live integration passes. Demo scope is a small curated public/synthetic audit with source-linked findings; an attacker test is an optional extension. No calendar commitments are made until team capacity and provider access are known.

## Proposed measurable release gates
- Matching: a held-out fixture set of at least 50 positive and 50 hard-negative items, covering short answers and multiple choice. Target precision at least 95%, fixture recall at least 90%, and false-positive rate at most 5%. Report counts and uncertainty; these are pilot engineering targets, not production validity claims.
- Timing: every verified_pre_cutoff claim has supporting version-specific evidence. Unknown and post-observed fixtures must never become verified pre-cutoff automatically.
- Privacy: all defined gold-egress, prompt-injection and cross-tenant test cases pass; no protected fields appear in recorded outbound payloads or logs. This is a test gate, not a universal security guarantee.
- Recovery: restart, duplicate delivery, timeout and cancellation fixtures preserve consistent state; no duplicate findings or unreserved new dispatch after budget exhaustion.
- Traceability: every confirmed finding resolves to a snapshot, locator, policy, item version and verifier version. Missing evidence prevents automatic confirmation.
- UX: upload through reviewed export passes end-to-end, including partial failure and SSE reconnect, with keyboard and focus checks.

## Pilot budget profile
Propose a default ten-item run, at most three search queries and five fetched pages per item, two concurrent discovery tasks, a fifteen-minute run deadline and a separately configured monetary ceiling. Agent/browser escalation is disabled by default. These limits are configuration starting points to calibrate with measured latency and current provider billing; they are not throughput guarantees.

## Release decision
Release the audit MVP at M3 only for controlled internal use. A hosted pilot requires M5 controls for the chosen scope. Failing a critical privacy or provenance gate blocks release; a failed optional experiment does not invalidate an otherwise complete exposure audit.

---
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

---
# Worked example from input to decision
## Synthetic input and policy
Item SYN-014 asks which fictional station has code K7. Options are A North, B East, C South and D West; the protected reference is B East. The audit policy permits ordinary reference research but prohibits retrieving benchmark answer keys. The evaluation cutoff is 1 October 2026 at 00:00 UTC. All content in this example is synthetic.

## Discovery and verification
The planner searches the public question wording without using the gold answer. A repository investigator retrieves a fixture page that repeats the item, lists options in a different order, and says East is correct. The system stores snapshot S-014 with its hash, retrieval time, excerpt locator and source URL in the fixture manifest.

The verifier establishes task identity using the question and all option texts. It maps the source answer to East rather than comparing the source letter with B. Task identity is exact and answer agreement is task_specific. The exposure claim is verified reference-answer exposure. A second page mentioning only code K7 and the letter B is rejected because it does not establish the same task.

## Timing
The page is retrieved on 1 November 2026. Its displayed date is not independently supported and there is no archived pre-cutoff snapshot. Temporal status is unknown. The report says Verified answer exposure; pre-evaluation availability unknown. It does not claim that the historical evaluation was compromised.

## Optional experiment
In a fresh blind run, the agent finds the fixture answer-key page through permitted browsing, retrieves its answer-bearing content and outputs East. The trusted grader marks the answer correct. The observable trajectory supports use of the answer-bearing page; the policy rule identifies prohibited answer-key retrieval. Report attribution as use_supported, not proven performance inflation.

If a paired controlled run with answer content redacted changes the result, record that intervention, repeated-run counts and confounds separately. A single changed output does not establish a general effect size. If the model times out instead, preserve an incomplete run rather than substituting a fallback model into the comparison.

## Review and export
The reviewer confirms the exposure claim and retains timing as unknown. The recommended action is to investigate historical availability and consider rotating the item for future restricted-source evaluations. Report version R-001 freezes the policy, item, snapshot, verifier and reviewer versions. No published score is automatically changed.