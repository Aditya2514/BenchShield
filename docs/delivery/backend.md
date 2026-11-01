# Backend delivery plan


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

