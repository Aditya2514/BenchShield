
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

