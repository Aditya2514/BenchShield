# BenchShield product and delivery blueprint
Version 0.3 | 1 November 2026 | Working codename

This blueprint defines a benchmark exposure audit product, its trust boundaries, a unified repository structure, and separate backend and frontend delivery phases. It supersedes v0.2 for delivery planning. The approved review refinements remain incorporated. This revision expands each delivery phase into numbered work packages, tests and handoffs; implementation has not started.

The first release helps benchmark maintainers discover public copies of evaluation questions and answers, inspect evidence, and decide what to do. Controlled attacker tests are optional and separately reported. An exposure finding remains useful when no attacker test has run.

## Product decision
Primary user: a benchmark maintainer conducting a preflight or retrospective audit. The central workflow is upload, configure policy and cutoff, investigate, verify evidence, review findings, optionally test exploitation, and export a versioned report.

The product cannot certify a benchmark as contamination-free, prove pretraining exposure, infer historical availability from today's search results, or automatically invalidate published scores. A correct answer or an accuracy gain alone does not prove prohibited retrieval.

## First release scope
Support public or synthetic, text-only benchmarks with exact short-answer and multiple-choice grading. Accept CSV and JSON through a versioned import schema. Support local exact and normalized matching, source-linked evidence, uncertain temporal assessments, human review, and one pinned attacker model configuration.

Defer arbitrary code execution, image/audio questions, broad rubric-based grading, continuous monitoring, production confidential web scanning, and automatic benchmark mutation. Semantic similarity may nominate candidates but cannot independently confirm a leak.

## Reading map
Pages 2 to 7 define policy, findings, evidence, experiments, architecture and contracts. Pages 8 and 9 define the repository. Pages 10 to 15 detail backend delivery; pages 16 to 21 detail frontend delivery. Pages 22 and 23 define release gates and coordination. Pages 24 and 25 contain the decision register and worked example.

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

# B0 Contracts and evaluation fixtures
## Outcome and entry requirements
Create a shared specification that both teams can implement without guessing. Entry: the v0.2 architecture baseline. Backend lead owns this phase; frontend lead reviews consumer-facing schemas and the evaluation owner reviews labels. Vendor selection is not required to build synthetic fixtures.

## Ordered work packages
- B0.1 Define CSV/JSON fields: external item ID, task type, question, choices, gold answer and optional metadata. Specify required fields, encoding, length limits, duplicate IDs, answer-option mapping and atomic import behavior. Invalid imports create no usable benchmark version.
- B0.2 Define immutable benchmark, item and policy versions. Specify exposure types, task identity, answer match, timing, experiment states and review transitions with examples for every enum value.
- B0.3 Write API schemas for imports, policy creation, investigation launch, cancellation, findings, reviews, experiments and report jobs. Include pagination, authorization expectations, idempotency, error codes and optimistic concurrency.
- B0.4 Specify the SSE envelope, ordering scope, replay window, reconnect cursor and snapshot-refresh fallback. Decide which fields may appear in public operational events and which require restricted evidence access.
- B0.5 Build development fixtures for exact matches, reordered choices, common-answer collisions, false positives, inaccessible pages, unknown dates, late observations, partial runs and policy blocks. Maintain a separate held-out set and label provenance.
- B0.6 Define provider adapter interfaces and fake implementations for discovery, reasoning, storage and grading. Specify usage accounting and failure categories without depending on a live SDK.

## Deliverables and repository ownership
Publish the versioned OpenAPI export, event schemas and examples in docs/contracts. Store synthetic inputs in fixtures and evaluation definitions in evals. Add a contract-generation command under scripts and document schema ownership. Record decisions in docs/adr. Provide a fixture manifest listing expected results, label rationale and development/held-out partition.

## Verification and completion gate
All examples validate against schemas. Negative fixtures fail with the expected machine-readable code. Frontend can generate a client and render a mock audit from the contracts. No schema exposes protected answers in read endpoints, progress events or finding summaries. Each status has at least one fixture; transitions have an explicit source and destination state.

## Demonstration and handoff
Walk through one successful and one incomplete audit using fixture responses. Handoff to F0/F1 includes import errors, policy options, event replay examples and report states. B1 may begin once intake and authorization contracts are stable; later schema changes require a versioned change and updated fixtures. Do not add live provider calls or tune prompts in this phase.

---

# B1 Secure backend foundation
## Outcome and dependencies
Accept authorized benchmark imports and preserve protected answers separately. Entry: B0 intake, identity and policy contracts. Backend lead owns delivery; security reviewer checks access boundaries. Select and document the authentication approach before implementing membership checks.

## Ordered work packages
- B1.1 Create the Python package, configuration validation, dependency lockfile, API entrypoint, health/readiness endpoints and structured error handling. Reject missing production secrets at startup without printing their values.
- B1.2 Add PostgreSQL migrations for workspaces, memberships, benchmark/item versions, policy versions and audit events. Define foreign keys, tenant constraints and immutable-version rules. Separate migration privileges from runtime privileges.
- B1.3 Implement authenticated workspace selection and server-side permission checks. Define who may upload, launch, review, export and administer retention. Apply authorization to every query and object operation; never trust workspace IDs from a client alone.
- B1.4 Implement bounded upload parsing and validation. Stage input, detect malformed rows and duplicate IDs, map choices to answer text, and commit only a fully valid import. Remove staged data on rejection; return row-level errors without echoing protected values.
- B1.5 Introduce the gold-vault interface and restricted credential boundary. Store protected answers through the intake service; give verifier runtime access through a separate identity. Exclude gold fields from general repositories and serializers.
- B1.6 Implement immutable policy creation, supported-task checks and public/synthetic classification. Reject confidential external-discovery requests with an actionable policy error. Add redacted audit events and request correlation IDs.

## Deliverables and locations
Implement api, domain, services, persistence, storage and policies modules plus migrations. Add an environment-variable example containing names and safe placeholders only. Document local startup and database reset for disposable development data. Publish stable intake endpoints to the frontend team.

## Required verification
Exercise valid, malformed, oversized, duplicate and unsupported-task uploads. Test unauthorized membership, cross-workspace IDs and object access. Capture API responses and logs during tests to assert protected values are absent. Confirm a failed import leaves no usable partial version. Verify migrations on a fresh database and an upgrade fixture.

## Completion gate and demonstration
An authorized user imports a synthetic benchmark, receives immutable IDs and reads metadata without gold fields. A second workspace cannot access it. Invalid input produces useful row errors and no partial benchmark. F1 can complete real import and policy setup. Stop here for foundation review; discovery workers and external calls belong to B2.

---

# B2 Bounded discovery and durable execution
## Outcome and dependencies
Run a recoverable investigation within enforced privacy and resource limits. Entry: B1 plus independently checked provider documentation, credentials and data terms. Backend lead owns orchestration; security reviewer approves outbound policy. F2 can build against B0 mocks while this work proceeds.

## Ordered work packages
- B2.1 Implement the web adapter for search/fetch with typed results, URL/redirect validation, response-size limits, request IDs and normalized errors. Use a fake adapter first, then a small public/synthetic live smoke test. Keep Agent escalation disabled by default.
- B2.2 Build the model registry and task-policy filter. Record role, capability, privacy eligibility, model identity, generation settings and approved fallback order. Bound retries and schema repair; route unresolved ambiguity to review.
- B2.3 Implement the central graph: validate, profile, plan, dispatch repository/research investigation, normalize evidence and transition to verification. Mirror discovery requires a recorded reason and remaining budget. Validate every role output before consuming it.
- B2.4 Implement durable jobs, leases, heartbeat, attempts and transactional outbox. Define restart recovery and duplicate-result handling. Persist task state before acknowledging work and make result writes idempotent.
- B2.5 Reserve query, fetch, token and monetary budgets atomically before dispatch. Reconcile actual usage, retain unknown charges conservatively and stop new work at exhaustion. Enforce run deadline and maximum concurrency independently of model instructions.
- B2.6 Implement cancellation, partial results and authenticated progress events. Cancel prevents new dispatch; late results cannot revive a terminal run. SSE replay uses stable IDs and instructs expired clients to refresh a snapshot.

## Deliverables and locations
Implement orchestration, agents, workers, web, providers, policies and telemetry. Deliver launch/status/cancel/events endpoints and a documented failure-state matrix. Add an operator view or command for inspecting stuck leases and task attempts without revealing benchmark content.

## Required verification
Inject rate limits, timeouts, malformed model output, redirect violations, hostile page instructions, duplicate delivery, worker crash and concurrent budget reservations. Verify exactly-once effects where application deduplication applies; explicitly record uncertainty for external provider execution and charges.

## Completion gate and demonstration
A ten-item synthetic audit records candidates and finishes or clearly reports partial coverage. Restart it during discovery and confirm no duplicate findings or budget overspend from new unreserved dispatch. Cancel during a fetch and inspect terminal state plus late-result handling. F2 can show live progress and reconnect. Scientific matching is still B3 work.

---

# B3 Verified evidence and the audit MVP
## Outcome and dependencies
Turn candidates into reviewable, reproducible findings and frozen reports. Entry: B2 normalized candidates and source snapshots. Backend lead owns services; evaluation owner signs off grader behavior and held-out results. This phase provides value without optional attacker tests.

## Ordered work packages
- B3.1 Preserve immutable source snapshots, content hashes, redirect history, retrieval timestamps, extraction versions and exact excerpt locators. Represent unavailable or restricted snapshots explicitly. Keep raw evidence separate from normalized text and interpretation.
- B3.2 Implement task-identity matching before answer agreement. Add exact/normalized short-answer grading and option-text mapping for reordered multiple-choice answers. Define punctuation and case rules; unsupported numeric/unit or semantic equivalence requires review rather than an invented match.
- B3.3 Implement independent exposure claims and temporal assessments. Require version-specific support for pre-cutoff claims. A late observation stays observed_post_cutoff unless introduction evidence exists. Unknown timing never downgrades verified answer exposure.
- B3.4 Assemble findings with claim status, limitations, verification versions and evidence references. Add paginated filters without hiding rejected or unresolved claims from authorized reviewers.
- B3.5 Implement append-only reviewer decisions, expected-version conflict detection and review history. Record why a claim was confirmed, rejected or sent back for evidence. Validate that automatic confirmation cannot occur when required evidence is missing.
- B3.6 Freeze report inputs and generate versioned exports asynchronously. Include policy, scope/budget, methodology, independent dimensions, reviewer decisions and limitations. Protect downloads with current authorization; an export failure does not change investigation success.

## Deliverables and locations
Implement verification, reporting, domain and review services. Publish findings/reviews/report endpoints and sample reports from synthetic fixtures. Record the grader version and normalization rules in docs/evaluation. Export evidence lineage alongside human-readable report content.

## Required verification
Run the held-out corpus once the implementation is frozen; disclose any subsequent tuning and re-evaluation. Check common-answer collisions, reordered choices, mismatches, missing snapshots, changed extraction versions and ambiguous dates. Test conflicting reviewer updates and report immutability after later decisions.

## Completion gate and demonstration
Meet the pilot precision, fixture-recall and false-positive targets from the release gates. Every confirmed claim resolves to a versioned snapshot and verifier. A reviewer rejects one false positive, confirms another finding and exports both decisions with timing caveats intact. B3 + F3 completes the internal audit MVP; hosted release still requires B5/F5.

---

# B4 Optional controlled experiments
## Outcome and dependencies
Measure observable attacker behavior without contaminating experiments with privileged discovery results. Entry: B3 frozen evidence and policy versions. Evaluation owner defines the protocol; backend lead implements isolation, execution and grading. This phase is optional for an audit-only release.

## Ordered work packages
- B4.1 Define immutable experiment configuration: item selection, three conditions, model/provider identity, available revision, prompts, generation settings, tool policy, budgets, repetition schedule and grader version. Reject incompatible or incomplete configurations before launch.
- B4.2 Create fresh runtime identities, sessions and caches for control, blind and evaluation-aware runs. Prevent access to investigator storage, discovery reports and protected gold. Record only observable calls, retrieved content and outputs; do not require private model reasoning.
- B4.3 Implement the no-web control and paired web-enabled conditions. Apply the same intended settings to paired browsing runs except for the evaluation-awareness instruction. Record the control's different tool access explicitly.
- B4.4 Disable model/provider fallback within comparative runs. Mark an interrupted run incomplete; retry under the same configuration as a separate attempt or create a new labelled configuration. Never silently merge unlike configurations.
- B4.5 Send final outputs to the trusted grader. Link retrieved content to observed answers and classify attribution conservatively. Check policy compliance independently of correctness; prohibited retrieval can occur even when the answer is wrong.
- B4.6 Add an answer-redaction intervention on a controlled fixture. Predefine repeated-run order and retain confounds. Aggregate completed-run counts, incomplete counts, policy violations, correctness and attribution with explicit denominators.

## Deliverables and locations
Implement experiments, experiment-worker policies, trusted grading interface and trajectory storage. Publish experiment creation/status/results contracts and a reproducible protocol in docs/evaluation. Supply synthetic trajectory fixtures for all frontend comparison states.

## Required verification
Use sentinel values to test that discovery-only evidence and vault answers cannot enter attacker context. Test provider outages, configuration drift, missing trajectory segments, denied tools and unsupported grading. Recompute aggregate metrics from raw run records and compare them with report outputs.

## Completion gate and demonstration
Run all three conditions on the same synthetic set, show a prohibited retrieval with correct output, and show an incomplete run without fallback. Demonstrate that these are distinct from proven causal score inflation. B4 + F4 enables optional experiments; experiment failure must not erase completed exposure findings.

---

# B5 Backend pilot hardening and operations
## Outcome and dependencies
Make the chosen audit-only or experiment-enabled scope supportable in a hosted pilot. Entry: B3, plus B4 if experiments are included. Backend/operations lead owns delivery; security and evaluation reviewers approve their release gates. Resolve hosting, authentication, storage and retention choices before this phase ends.

## Ordered work packages
- B5.1 Define deployment configuration, secret injection, restricted service identities, migrations and health checks. Establish staging and production separation. Document rollback of application versions and recovery from failed migrations without assuming all data migrations are reversible.
- B5.2 Implement retention schedules, user-requested deletion, immediate access revocation and asynchronous cleanup of objects, caches and derived content. Document backup expiry and deletion windows. Reports must show when supporting evidence has expired.
- B5.3 Add rate limits, upload quotas, worker concurrency caps, queue-age alerts and provider-failure alerts. Set a measured pilot load profile and cost ceiling before testing; distinguish platform failures from provider latency.
- B5.4 Test database/object-store backup and restore into an isolated environment. Measure achieved recovery point and recovery time; have the owner accept targets based on actual results. Check evidence references and report versions after restoration.
- B5.5 Run the privacy, prompt-injection, authorization, SSRF/redirect and object-download regression suites. Scan dependencies and secrets. Triage findings by exploitability and affected boundary; unresolved critical access or egress defects block release.
- B5.6 Write runbooks for provider outage, stalled lease, unexpected spend, evidence deletion, failed export and security incident. Include the action, responsible role, diagnostic signals and recovery verification.

## Deliverables and locations
Complete infra deployment definitions, environment documentation, operational dashboards, alert routing and docs/security records. Attach evaluation results, recovery measurements and known limitations to the release checklist. Assign an owner for each alert and runbook; an unowned alert is not an operational control.

## Required verification
Run a staging end-to-end audit with cancellation and one provider failure. Exercise restore and deletion rather than checking only configuration. Inspect real outbound test payloads and telemetry for protected data. Confirm an authenticated user cannot reuse a report URL after access revocation.

## Completion gate and handoff
All mandatory release gates pass for the chosen scope; no critical privacy/provenance defect remains. Operators can restore, cancel, diagnose and explain incomplete results. Hand off staging evidence and runbooks to the pilot owner. Continuous monitoring, confidential web discovery, code execution and new graders remain separately scoped later phases.

---

# F0 Product flows and contract-driven mocks
## Outcome and dependencies
Define a usable audit journey before integrating live services. Entry: B0 draft contracts and synthetic fixture manifest. Frontend/product lead owns delivery; backend lead reviews contract usage. Use mocks so design work does not wait for provider integration.

## Ordered work packages
- F0.1 Map the maintainer journey: select workspace, import benchmark, inspect validation, configure policy/budget, launch, monitor, review evidence and export. Add the optional experiment branch after the audit result.
- F0.2 Define navigation and route identities for benchmark versions, investigations, findings and reports. Specify refresh and deep-link behavior. Keep workspace context visible and plan safe handling of inaccessible IDs.
- F0.3 Design finding vocabulary around independent exposure, timing, attribution and compliance. Define copy for unknown, not tested, incomplete, blocked and no evidence within scope; these must not look equivalent.
- F0.4 Create wireframes for import, policy setup, progress, findings list, evidence detail, review history and reports. Define field labels, focus order, keyboard actions and empty/loading/error states at the same time.
- F0.5 Generate the API client from reviewed schemas and create mock handlers for happy paths, row errors, permission denial, provider outage, budget exhaustion, replay expiry and review conflicts. Keep all data synthetic and schema-validated.
- F0.6 Establish component primitives for forms, status labels, tables, dialogs and error summaries. Document when to use each and how screen readers receive dynamic status changes without excessive announcements.

## Deliverables and locations
Store route and flow decisions in docs/architecture and mock scenarios in apps/frontend/src/mocks. Use components for shared presentation and features for workflow-specific screens. Publish a mock scenario catalogue keyed to B0 fixture IDs, including the intended user action and expected next state.

## Verification and completion gate
Walk through a full mock audit and a failed/partial one without backend availability. Every displayed status maps to a contract value. A user can identify what is known, what is unknown and what action is available. No mock UI relies on a single integrity score or hides the tested search scope.

## Demonstration and handoff
Show the backend team the exact requests and fields each screen needs; resolve gaps before coding around them. F1 can proceed after intake/policy mocks are stable. F2/F3 designs may continue in parallel using versioned fixtures. This phase delivers interaction specifications and mock behavior, not production authorization or live investigation execution.

---

# F1 Application shell and benchmark intake
## Outcome and dependencies
Let an authorized user prepare a valid benchmark and evaluation policy. Entry: F0 shell/form designs and B0 stable intake schemas; live integration depends on B1. Frontend lead owns delivery, with backend review of access and sensitive-field behavior.

## Ordered work packages
- F1.1 Set up the TypeScript application, route structure, generated-client wrapper, environment configuration and standard request-error handling. Add session/workspace context and clear access-denied and session-expired screens.
- F1.2 Build benchmark selection, version metadata and import screens. Show supported file types/task types, limits and a downloadable synthetic example. Support field mapping only if the import contract includes it; do not infer unsupported formats silently.
- F1.3 Validate basic format client-side for fast feedback, then treat server validation as authoritative. Present row numbers and error codes in an accessible summary. Allow correction/retry without displaying or persisting protected answer values in error messages.
- F1.4 Handle upload states: selected, uploading, rejected and accepted. Prevent duplicate submissions while in flight and preserve only safe form state. Clear sensitive file/text buffers after success, cancellation or workspace change.
- F1.5 Build policy configuration for allowed sources/tools, prohibited answer access, evaluation cutoff/timezone, public/synthetic classification, retention profile and investigation budget. Explain confidential-discovery restrictions before submission.
- F1.6 Build a review-before-launch summary showing benchmark version, policy version, outbound destinations and limits. Save immutable versions through the API and use returned IDs for subsequent steps.

## Deliverables and locations
Implement app, features/benchmarks, features/policies and shared form components. Provide integration fixtures for every import error and policy block. Add field-level help that describes the user's decision rather than internal SDK or framework details.

## Required verification
Test malformed/oversized files, duplicate clicks, delayed responses, session expiry and workspace switching. Check keyboard navigation, focus on the validation summary and screen-reader field associations. Inspect browser persistence, URLs and analytics payloads for protected content. Verify client and server validation disagreements resolve to the server result.

## Completion gate and demonstration
Import a real synthetic fixture through B1, fix a rejected row and save a policy. Confirm the user can see which version will be audited and that no investigation starts accidentally. F1 + B1 completes intake; the launch button can hand off the selected IDs to F2 without embedding protected data.

---

# F2 Investigation launch and live progress
## Outcome and dependencies
Make long-running audits understandable and recoverable from the user's perspective. Entry: F1 intake flow and B0 events/status contracts; live completion depends on B2. Frontend lead owns delivery with backend review of cancellation and replay semantics.

## Ordered work packages
- F2.1 Implement launch with a stable idempotency key per submission attempt. Show accepted/queued status immediately from the server response. Resolve a lost response by checking the attempt rather than issuing an unrelated duplicate job.
- F2.2 Build the investigation overview with phase, item counts, source coverage, reserved/used budget and deadline. Explain that progress counts describe work completed, not scientific confidence or guaranteed internet coverage.
- F2.3 Implement authenticated SSE handling, event deduplication and cursor persistence limited to safe identifiers. Reconcile streamed events with the authoritative state snapshot; do not derive terminal status solely from animation or elapsed time.
- F2.4 Handle disconnect, reconnect, expired replay window and page refresh. Use a snapshot refresh when replay is unavailable. If a bounded polling fallback is adopted, document its cadence and stop it at terminal states or logout.
- F2.5 Add cancellation with request-pending and server-confirmed states. Explain that already-running external calls may finish. Keep partial findings accessible where authorized and never restore running status from a late event.
- F2.6 Design distinct views for provider failure, policy block, exhausted budget and partial coverage. Allow supported retry/new-investigation actions without implying the previous result was a clean audit.

## Deliverables and locations
Implement features/investigations and API event utilities. Add mock streams with duplicate, delayed, missing and out-of-order events. Publish a UI state transition table aligned with backend states, including what controls remain enabled in each state.

## Required verification
Refresh mid-run, disconnect the stream, replay duplicates, expire the cursor, cancel during an active fetch and receive late events. Confirm the displayed state converges with the backend snapshot. Check live announcements and avoid focus jumps or excessive screen-reader updates as events arrive.

## Completion gate and demonstration
Launch a synthetic audit through B2, reconnect after a network interruption, then cancel another run. The user sees accurate terminal status, coverage limits and budget figures. An outage cannot produce a no-exposure message. F2 hands completed/partial investigation IDs to the evidence review screens in F3.

---

# F3 Evidence review and report export
## Outcome and dependencies
Enable a maintainer to understand and adjudicate findings, then export the reviewed state. Entry: F2 navigation and B3 findings/reviews/report contracts. Frontend lead owns delivery; evaluation owner reviews wording and evidence presentation.

## Ordered work packages
- F3.1 Build a paginated findings list with independent filters for exposure type, verification status, timing and reviewer decision. Keep applied filters visible and distinguish zero matching filtered results from an audit with no observed evidence.
- F3.2 Build evidence detail showing task identity, answer-match method, source locator, retrieval time, temporal support and limitations. Show a safe source link and authorized snapshot access. Render retrieved text as data; block scripts, unsafe links and active document content.
- F3.3 Display unknown timing, unavailable/expired evidence and unsupported grading prominently enough to affect interpretation. Never equate a source publication claim with verified pre-cutoff accessibility.
- F3.4 Implement confirm, reject and request-more-evidence actions with required reasons where specified. Submit the expected finding version. On conflict, show the current decision and let the reviewer reconcile instead of overwriting silently.
- F3.5 Show append-only review history with actor, time, reason and referenced version. Keep unsaved edits distinct from committed decisions and warn before navigating away from an unfinished review.
- F3.6 Build export creation, job status, authorized download and report-version history. Explain what was frozen and whether a newer review exists. Handle failed exports independently of investigation status and avoid duplicate export jobs on repeated clicks.

## Deliverables and locations
Implement features/findings, features/reviews and features/reports. Provide component fixtures for long excerpts, missing evidence, conflicting reviews, no results, rejected claims and unknown timing. Keep report and screen terminology consistent.

## Required verification
Test malicious source markup, inaccessible URLs, expired download access, long content, pagination/filter changes and two reviewers editing the same finding. Verify keyboard access to evidence and review actions. Compare the exported report's frozen version with the version displayed in report history.

## Completion gate and demonstration
Using B3, review the worked example: confirm the task-specific answer match, retain unknown timing, reject an unrelated common-answer collision and export a versioned report. A second reviewer triggers and resolves a conflict. B3 + F3 completes the internal audit MVP without requiring an attacker run.

---

# F4 Optional experiment setup and comparison
## Outcome and dependencies
Let users request controlled tests and interpret outcomes without overstating causality. Entry: F3 evidence context and B4 experiment contracts. Frontend lead owns screens; evaluation owner reviews comparison labels, denominators and attribution explanations.

## Ordered work packages
- F4.1 Add an explicit optional-test entry point after the audit. Show the selected benchmark/policy versions and item set. Explain that the experiment uses isolated contexts rather than feeding discovered answers to attackers.
- F4.2 Build configuration for conditions, permitted tools, budgets and repetitions from supported backend options. Present pinned model/provider identity and available revision. Display the intended difference between blind and evaluation-aware conditions.
- F4.3 Validate configuration before submission and show expected resource limits. Use idempotent launch behavior. Expose queued/running/completed/incomplete states per run without treating every missing answer as incorrect.
- F4.4 Build condition comparison using separate columns for retrieval, correctness, policy compliance and attribution. Display numerator/denominator counts, completed runs and incomplete runs. Group changed configurations separately rather than pooling them into one percentage.
- F4.5 Build a trajectory viewer for observable queries, tool responses, source excerpts and final outputs. Respect evidence authorization and sanitize source content. Do not imply the viewer exposes hidden model reasoning.
- F4.6 Show intervention results only when the backend provides the recorded design, repetitions and limitations. Use wording such as use supported or intervention supported; avoid presenting a single changed answer as proven general performance inflation.

## Deliverables and locations
Implement features/experiments and shared comparison/trajectory components. Add mock scenarios for successful prohibited retrieval, correct answers without retrieval, incorrect answers after retrieval, denied tools, provider outages and configuration changes. Export methodology alongside result summaries.

## Required verification
Cross-check all displayed rates against fixture counts. Test zero completed runs, missing trajectory segments, different models, absent revision metadata and expired evidence. Verify that incomplete runs are visible but excluded from completed-run success denominators as defined in the protocol.

## Completion gate and demonstration
Run the B4 three-condition fixture, inspect a prohibited retrieval and explain why correctness alone does not prove exploitation. Show an interrupted run and a separately labelled configuration. Optional experiment failure must not hide or reclassify the existing exposure audit. The audit-only pilot may omit this phase.

---

# F5 Pilot usability and frontend resilience
## Outcome and dependencies
Make the chosen workflow usable under realistic errors and access changes. Entry: F3, plus F4 for experiment-enabled scope, with B5 staging available for integrated checks. Frontend lead owns delivery; product owner accepts usability outcomes and security reviewer checks browser-facing boundaries.

## Ordered work packages
- F5.1 Audit every route for loading, empty, permission-denied, expired-session, partial-data and retry states. Preserve safe user work where possible, but clear sensitive state on logout and workspace changes. Ensure errors provide an actionable next step.
- F5.2 Check keyboard navigation, focus management, semantic controls, screen-reader labels, status announcements, contrast and zoom. Define the supported browser/device matrix before testing; prioritize desktop evidence review with usable narrow-screen layouts.
- F5.3 Exercise long findings lists and large excerpts using the agreed pilot dataset. Measure route responsiveness and rendering cost; add pagination or virtualization only where necessary and preserve accessibility.
- F5.4 Test unauthorized deep links, revoked report access, stale sessions and cross-workspace navigation. Review unsafe URL handling, source rendering, client telemetry and browser storage for protected data leakage.
- F5.5 Run end-to-end flows against staging: import, policy setup, launch, reconnect, cancel, review conflict and export. Include optional experiments only when in release scope. Run critical-path tests in CI with stable synthetic fixtures.
- F5.6 Conduct a small usability pilot with representative maintainers. Ask them to import a benchmark, explain unknown timing, reject a false positive and export a reviewed report without coaching. Record observed failures and resolve blockers before release.

## Deliverables and locations
Complete frontend component/accessibility/E2E test suites, browser support notes, known limitations and a release checklist. Record usability observations and fixes in docs/delivery. Coordinate error messages and operational support links with B5 runbooks.

## Required verification
Confirm every release-critical flow has both a success path and a meaningful failure-path test. Manually inspect keyboard focus and evidence readability in addition to automated accessibility checks. Re-run affected flows after fixes; avoid calling a passing automated scan a complete accessibility audit.

## Completion gate and handoff
No unresolved blocker prevents intake, monitoring, evidence review or export. Representative users complete the core tasks and distinguish verified exposure from untested exploitation and unknown timing. B5 + F5 qualifies the hosted pilot for the chosen scope. Record remaining nonblocking issues with owners rather than hiding them in a general polish backlog.

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

# Delivery sequencing and phase completion
## Parallel work and integration order
Start B0 and F0 together. The backend lead owns schemas; the frontend lead validates usability and required fields. After the intake contract is stable, B1 and F1 proceed together. Frontend progress against mocks is valuable but does not count as a completed live integration milestone.

After B1, prioritize B2 discovery and F2 progress screens. F3 component work can proceed on B0 fixtures while B3 is built. Integrate in small slices: one imported item, one investigation, one verified finding, one review decision and one frozen report. Do not wait for every screen or specialist role before exercising the full path.

Audit-only pilot path: B0/F0 through B3/F3, then B5/F5. Experiment-enabled pilot path: add B4/F4 before final hardening. Early security and accessibility work remains mandatory in each phase; B5/F5 consolidates and exercises it rather than introducing it for the first time.

## Work package tracking
Track every numbered work package as a backlog item with its owner, dependencies, affected modules, contract changes, acceptance evidence and status. Use not_started, in_progress, blocked, in_review and done. A blocked item records the specific external dependency and what independent work can continue.

Suggested first vertical slice: B0.1 import schema and matching F0 intake mocks; B1.4 validated import and F1.3 error presentation; B2.1 fake discovery adapter and F2.2 progress; B3.2 verification and F3.2 evidence detail. Replace fake adapters with approved integrations only after the boundaries are exercised.

## Completion evidence
Each phase review includes a brief working demonstration, relevant test results, contract/fixture version, known limitations and updated documentation. Done means the exit gate passed, not merely that files exist. Deferred scope and failing required tests must remain visible. Code review checks tenant boundaries, evidence lineage and failure semantics alongside functionality.

For a contract change, update the schema, generated client, mocks and affected backend/frontend tests together. Breaking changes require a migration or versioning decision and a named consumer handoff. A frontend screen cannot silently reinterpret a backend status to avoid a contract change.

## Capacity and estimates
Assign accountable roles before attaching dates. With one developer, execute the same vertical slices sequentially; with separate backend/frontend contributors, use the contract to parallelize. Estimate numbered work packages after a short technical discovery, and keep provider approval, hosting and security review as explicit external dependencies. No duration in this plan implies a delivery commitment.

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
