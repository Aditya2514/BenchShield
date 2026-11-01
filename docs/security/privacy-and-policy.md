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
