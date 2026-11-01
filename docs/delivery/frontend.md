# Frontend delivery plan


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

