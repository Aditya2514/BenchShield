# BenchShield Frontend UX & Contract Specification
Phase F0 Delivery Document | 1 November 2026

This document defines the contract-driven UX, navigation, accessible status vocabulary, ASCII wireframes, mock scenarios, and open questions for BenchShield.

---

## 1. Information Architecture & Navigation

The BenchShield UI is structured around the auditor workflow:
```text
+------------------------------------------------------------------------------------------------+
|  BENCHSHIELD [v0.2]   | Workspace: [Acme AI Evaluation v]   | Audit: [SYN-014 Preflight v]     |
|  [1. Benchmarks]   [2. Policies]   [3. Investigations]   [4. Findings]   [5. Experiments]   [6. Reports]
+------------------------------------------------------------------------------------------------+
```

### Core Navigation Rules
1. **No Opaque Score**: Every view presents exposure type, task identity, answer match, temporal status, attribution, and policy compliance as independent dimensions.
2. **Never Mask Incomplete Audits**: Partial coverage is prominently badged across headers and banners; incomplete audits never show "no exposure detected".
3. **Escaped Evidence Only**: Raw snapshots and excerpts are untrusted and rendered as plain escaped text only.
4. **Zero Gold In Browser Storage**: Reference answers never enter `localStorage`, `sessionStorage`, or `IndexedDB`.

---

## 2. Accessible Status Vocabulary

Every status employs distinct icons, high-contrast colors (≥ 4.5:1), and semantic text so no state is conveyed by color alone.

| Dimension | Allowed Values | Accessible Badge & Icon |
| :--- | :--- | :--- |
| **Temporal Status** | `verified_pre_cutoff` | `[!] Verified Pre-Cutoff` (Red border, AlertTriangle) |
| | `observed_post_cutoff` | `[~] Observed Post-Cutoff` (Amber border, Clock) |
| | `verified_introduced_post_cutoff` | `[✓] Verified Post-Cutoff Intro` (Blue border, CheckCircle) |
| | `unknown` | `[?] Timing Unknown` (Slate border, HelpCircle) |
| **Claim Status** | `candidate` | `[?] Candidate Match` |
| | `verified` | `[!] Verified Claim` |
| | `rejected` | `[X] Rejected Match` |
| | `needs_review` | `[!] Needs Review` |
| **Task Identity** | `exact` \| `equivalent` \| `ambiguous` \| `different` | Monospace textual badge |
| **Answer Match** | `exact` \| `normalized` \| `task_specific` \| `mismatch` \| `not_applicable` | Monospace textual badge |
| **Attribution** | `none` \| `retrieval_observed` \| `use_supported` \| `intervention_supported` | Plain text descriptor |
| **Policy Compliance** | `permitted` \| `violated` \| `unknown` | Semantic tag with applicable rule link |

---

## 3. Screen ASCII Wireframes

### Screen 1: Benchmarks Intake & Row Validation (`features/benchmarks`)
```text
+------------------------------------------------------------------------------------------------+
| BENCHMARKS / IMPORT BENCHMARK ITEMS                                                             |
+------------------------------------------------------------------------------------------------+
| Benchmark Name: [ Synthetic Reasoning Suite v1             ]                                  |
| Import Format:  (o) JSON   ( ) CSV                                                             |
| Upload File:    [ Choose File: syn014_items.json           ]  [ Validate & Stage File ]         |
|                                                                                                |
| INTAKE PREFLIGHT VALIDATION SUMMARY:                                                          |
| Total Rows: 50  |  Valid: 48 [✓]  |  Invalid: 2 [!]                                            |
|                                                                                                |
| ROW VALIDATION ERRORS (2):                                                                     |
| +------+----------+-------------------+------------------------------------------------------+ |
| | Row  | Item ID  | Error Code        | Actionable Explanation                               | |
| +------+----------+-------------------+------------------------------------------------------+ |
| | 14   | SYN-014b | empty_question    | Question text is empty or missing.                   | |
| | 32   | SYN-032  | invalid_options   | Multiple-choice format requires at least 2 options.  | |
| +------+----------+-------------------+------------------------------------------------------+ |
| [ Fix & Re-upload ]                                     [ Proceed with 48 Valid Rows -> ]     |
+------------------------------------------------------------------------------------------------+
```

### Screen 2: Policies Form & Privacy Scope (`features/policies`)
```text
+------------------------------------------------------------------------------------------------+
| POLICIES / CONFIGURE IMMUTABLE EVALUATION POLICY                                               |
+------------------------------------------------------------------------------------------------+
| Cutoff Date:     [ 2026-10-01 ]   Timezone: [ UTC (Coordinated Universal Time) v ]             |
|                                                                                                |
| Allowed Source Classes:                                                                        |
|   [X] Public Code Repositories (GitHub, GitLab)                                                |
|   [X] Research Web / ArXiv                                                                     |
|   [ ] Conditional Mirror Discovery (Requires explicit bounded trigger)                        |
|                                                                                                |
| Privacy & Egress Controls:                                                                     |
|   [X] Prohibit answer-key access (Flag any source containing explicit benchmark answer sheets)|
|   [ ] Benchmark identification permitted (Allow agents to search benchmark title)              |
|                                                                                                |
| Budget Ceilings:                                                                               |
|   Max search queries/item: [ 3 ]    Max fetched pages/item: [ 5 ]                              |
|   Max run deadline (sec):  [ 900 ]  Monetary ceiling ($):   [ 15.00 ]                          |
| Reviewer Identity:         [ rev-maintainer-01              ]                                  |
|                                                                                                |
| [ Create Immutable Policy Version ]                                                            |
+------------------------------------------------------------------------------------------------+
```

### Screen 3: Investigation Operations & Timeline (`features/investigations`)
```text
+------------------------------------------------------------------------------------------------+
| INVESTIGATION: inv-syn014-01                       Status: [ RUNNING / DISCOVERING ]           |
| Benchmark: Synthetic Reasoning v1 (48 items)       Policy: pol-syn014-v1                       |
+------------------------------------------------------------------------------------------------+
| [!] PARTIAL COVERAGE WARNING: External search encountered transient provider outage (2 dropped)|
+------------------------------------------------------------------------------------------------+
| PROGRESS TIMELINE:                                                                             |
| [11:58:00] Queued -> Validated policy and budget reservation ($15.00 ceiling)                  |
| [11:59:10] Discovering -> Query 1/3 dispatched: "fictional station K7"                         |
| [12:00:22] Candidate found -> Snapshot snap-syn014-s01 captured (SHA-256: a1b2c3...)          |
|                                                                                                |
| BUDGET & COUNTS:                                                                               |
| Processed: 1 / 1 items | Spend: $1.25 / $15.00 | Queries: 2 / 3 | Fetched: 3 / 5                |
| Candidates Discovered: 2 | Verified Findings: 1                                                |
|                                                                                                |
| [ Cancel Investigation ]                                        [ Refresh State Snapshot ]     |
+------------------------------------------------------------------------------------------------+
```

### Screen 4: Findings Table — Independent Dimensions (`features/findings`)
```text
+------------------------------------------------------------------------------------------------+
| FINDINGS / EXPOSURE CLAIMS (Zero Opaque Score)                                                 |
| Filters: [ Dimension: All v ] [ Status: All v ] [ Temporal: All v ] [ Policy: All v ]           |
+------------------------------------------------------------------------------------------------+
| +----------+---------------+---------------+---------------+---------------+-----------------+ |
| | Item ID  | Claim Status  | Dimension     | Task Identity | Answer Match  | Temporal Status | |
| +----------+---------------+---------------+---------------+---------------+-----------------+ |
| | SYN-014  | [!] Verified  | ref_answer    | exact         | task_specific | [?] Unknown     | |
| | SYN-015  | [?] Candidate | quest_context | ambiguous     | mismatch      | [~] Post-Cutoff | |
| +----------+---------------+---------------+---------------+---------------+-----------------+ |
| Showing 1 - 2 of 2 findings.                                                                   |
+------------------------------------------------------------------------------------------------+
```

### Screen 5: Evidence Review & 409 Conflict Flow (`features/reviews`)
```text
+------------------------------------------------------------------------------------------------+
| EVIDENCE REVIEW: Item SYN-014 (Finding #find-syn014-01 | Current Version: v2)                  |
+------------------------------------------------------------------------------------------------+
| SOURCE EVIDENCE (Untrusted plain text snapshot):                                              |
| URL:  https://synthetic-repo.example.com/solutions/k7-station.html                             |
| Time: 2026-11-01T12:00:00Z | Hash: sha256-a1b2c3d4e5f6...                                      |
| +--------------------------------------------------------------------------------------------+ |
| | "Exam Question: Which fictional station has code K7? Options: [West, South, East, North].   | |
| |  Correct Answer: East (Code K7 corresponds to East station)."                              | |
| +--------------------------------------------------------------------------------------------+ |
|                                                                                                |
| REVIEW DECISION FORM:                                                                          |
| Action:  (o) Confirm Verified Exposure   ( ) Reject False Positive   ( ) Needs More Evidence   |
| Reason:  [ Explicit task match found with reordered options. East mapped to B.               ] |
| Expected Version: [ 2 ]                                                                        |
|                                                                                                |
| [!] VERSION CONFLICT (409): Another reviewer updated this finding to v3. [ Refresh & Resolve ] |
|                                                                                                |
| [ Submit Review Decision ]                                                                     |
+------------------------------------------------------------------------------------------------+
```

### Screen 6: Optional Experiments Comparison (`features/experiments`)
```text
+------------------------------------------------------------------------------------------------+
| CONTROLLED ATTACKER EXPERIMENTS (Optional Evaluation)                                         |
| Pinned Model: gpt-4o-2026-08-06 (rev-1) | Tool Policy: allowlisted_browsing_v1                 |
+------------------------------------------------------------------------------------------------+
| CONDITION COMPARISON (Explicit Denominators):                                                  |
| +------------------+------------+--------------+---------------+-----------------------------+ |
| | Condition        | Completed  | Incomplete   | Correct Ans   | Attribution Strength        | |
| +------------------+------------+--------------+---------------+-----------------------------+ |
| | Control (No Web) | 10 / 10    | 0            | 2 / 10 (20%)  | none                        | |
| | Blind Browsing   | 10 / 10    | 0            | 8 / 10 (80%)  | retrieval_observed          | |
| | Eval-Aware       | 9 / 10     | 1 (Timeout)  | 8 / 9 (88%)   | use_supported               | |
| +------------------+------------+--------------+---------------+-----------------------------+ |
| Note: Completed-run rate 90%. Incomplete runs are excluded from accuracy denominator.          |
| Trajectory Viewer: Run #01 [Browse: station K7 -> Fetch: repo/sol -> Output: East]             |
+------------------------------------------------------------------------------------------------+
```

### Screen 7: Report History & Freeze (`features/reports`)
```text
+------------------------------------------------------------------------------------------------+
| REPORTS / AUDIT REPORT VERSION R-001 (Frozen)                                                  |
| Frozen At: 2026-11-01T12:45:00Z | Benchmark: SYN-v1 | Policy: pol-syn014-v1                    |
+------------------------------------------------------------------------------------------------+
| Verified Findings: 1 | Unresolved Claims: 0 | Reviewer Actions: 1                              |
| Scope Limitations:                                                                             |
| - Real-web temporal support unknown; page discovered post-cutoff without archive evidence.      |
|                                                                                                |
| [ Download Authorized PDF/JSON Report ]   (Expires in: 23 hours 58 mins)                       |
|                                                                                                |
| [!] REPORT EXPORT FAILURE NOTIFICATION:                                                        |
| "Report export job failed (export_failed: Object store timeout). Investigation data is intact."|
+------------------------------------------------------------------------------------------------+
```

---

## 4. Blueprint Ambiguities & Open Questions

1. **SSE Cursor Expiry Fallback**: If an SSE reconnect cursor is expired by the backend server, should the frontend automatically trigger a silent full `GET /api/v1/investigations/{id}` re-fetch or prompt the user with an in-banner refresh action? *(Default implemented: silent transparent snapshot re-fetch with user notification pill).*
2. **Review Decision Append vs. Overwrite**: Does the backend persist full reviewer decision history or only the latest head decision with a version pointer? *(Default implemented: monotonic version increments with conflict detection).*
3. **Authorized Download URL Expiry**: When a pre-signed report download URL expires, should the UI re-issue `GET /api/v1/reports/{id}` to acquire a fresh URL automatically on button click? *(Default implemented: fresh token request upon click).*

