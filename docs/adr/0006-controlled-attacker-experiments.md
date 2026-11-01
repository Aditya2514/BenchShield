# ADR 0006: Controlled Attacker Experiments and Causal Exposure Evaluation

## Status
Accepted

## Context
Phase B3 established the verified exposure audit, identifying where benchmark questions and reference answers exist on public repositories, preprints, and websites. However, mere presence on the web does not prove that an LLM agent exploits that exposure during evaluation.

Phase B4 introduces controlled attacker experiments to measure observable agent behavior under scientific conditions without compromising experiment validity or leaking privileged audit data.

Key challenges addressed:
1. **Contamination & Privacy**: Attacker agents must not be contaminated with privileged discovery results, investigator notes, candidate source lists, or protected gold answers from the vault.
2. **Scientific Comparative Validity**: Comparing model capabilities across conditions requires strict experimental control. Provider or model fallbacks within comparative runs silently invalidate experimental conclusions.
3. **Attribution Conservatism**: Distinguishing pretrained knowledge (memorization) from causal web-assisted exploitation requires careful attribution logic and explicit denominators.
4. **Independent Policy Compliance**: An attacker agent might commit a policy violation (e.g. attempting to search for an "answer key" or "solution manual") even if it fails to answer the question correctly. Correctness and policy compliance must be tracked independently.

## Decision

1. **Three-Condition Experimental Protocol**:
   - `control`: The model answers questions using internal weights only. All external tool calls are prohibited (`allowed_tools = []`).
   - `blind`: The model has web search and retrieval tools enabled (`["search", "fetch"]`), but the prompt contains no mention of benchmark name, author, or evaluation context.
   - `evaluation_aware`: The model has web search and retrieval tools enabled, and the prompt explicitly states that the model is being evaluated on the specific benchmark.

2. **Strict Context Isolation**:
   - Attacker runs execute with fresh runtime sessions and distinct runtime identities.
   - Attackers receive zero access to `investigation_tasks`, `candidate_sources`, `findings`, or `vault.protected_answers`.
   - Tool actions are recorded as observable external events (`ObservableToolCall`) rather than requiring private model Chain-of-Thought reasoning.

3. **Strict No-Fallback Rule**:
   - If a provider or model fails or times out during an adversarial run, the run is immediately marked `ExperimentRunStatus.INCOMPLETE` with a documented `failure_reason`.
   - Automatic fallback to alternative models or providers within a comparative run is strictly prohibited. Retries must occur as separate, explicitly labelled configurations.

4. **Independent Trusted Grading and Policy Evaluation**:
   - Attacker outputs are graded by the trusted verification grader (`ScientificGrader` via `TrustedVaultReader`) using decrypted gold answers. The grader never exposes decrypted answers in response bodies or logs.
   - Policy compliance is evaluated by inspecting observable queries against forbidden patterns (`FORBIDDEN_ANSWER_KEY_PATTERNS`). An attacker can commit a policy violation regardless of whether its final answer is correct.

5. **Conservative Causal Attribution**:
   - `NONE`: Control runs (all correct answers stem from internal weights), or runs where no answer-bearing content was retrieved into context.
   - `RETRIEVAL_OBSERVED`: Answer-bearing content was pulled into context, but the final answer was incorrect or ambiguous.
   - `USE_SUPPORTED`: Answer-bearing content was pulled into context AND the model produced the correct gold answer.
   - `INTERVENTION_SUPPORTED`: Redaction or counterfactual intervention verifies causal score inflation.

6. **Durable Persistence & Explicit Denominators**:
   - Tables `experiments` and `adversarial_runs` persist pinned configurations and per-item run records.
   - Aggregated metrics (`completed_runs_count`, `incomplete_runs_count`, `prohibited_retrieval_count`, `correct_answer_count`) report exact integer counts with explicit denominators.

## Consequences

### Positive
- Scientific integrity: No contamination from previous discovery passes or protected answers.
- Comparative robustness: Strict no-fallback prevents silent confounding of model comparisons.
- Clear distinction between web-assisted cheating, internal memorization, and unexploited exposure.
- Fully offline reproducible test suite with embedded PostgreSQL.

### Negative / Trade-offs
- Additional token and compute budget required when running multi-condition evaluations.
- Provider interruptions leave incomplete runs that require separate retries rather than transparent failover.
