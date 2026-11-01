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
