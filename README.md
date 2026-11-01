<div align="center">

<img src="docs/assets/readme/hero.svg" alt="BenchShield — exposure audits for AI benchmarks" width="100%"/>

<br/>

<a href="#quick-start"><img src="https://img.shields.io/badge/python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+"/></a>
<a href="#architecture"><img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/></a>
<a href="#architecture"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16"/></a>
<a href="#architecture"><img src="https://img.shields.io/badge/Pydantic-v2-E92063?style=for-the-badge&logo=pydantic&logoColor=white" alt="Pydantic v2"/></a>
<a href="#quick-start"><img src="https://img.shields.io/badge/uv-managed-DE5FE9?style=for-the-badge&logo=uv&logoColor=white" alt="uv"/></a>
<br/>
<a href="#security-model"><img src="https://img.shields.io/badge/vault-AES--256--GCM-0F172A?style=for-the-badge&logo=letsencrypt&logoColor=22D3EE" alt="AES-256-GCM vault"/></a>
<a href="#roadmap"><img src="https://img.shields.io/badge/phase-B2%20in%20verification-F59E0B?style=for-the-badge" alt="Phase B2 in verification"/></a>
<a href="#roadmap"><img src="https://img.shields.io/badge/frontend-planned-64748B?style=for-the-badge&logo=react&logoColor=white" alt="Frontend planned"/></a>

<br/><br/>

<b>
<a href="#why">Why</a> ·
<a href="#how-it-works">How it works</a> ·
<a href="#architecture">Architecture</a> ·
<a href="#security-model">Security</a> ·
<a href="#durable-execution">Durability</a> ·
<a href="#verification">Verification</a> ·
<a href="#roadmap">Roadmap</a> ·
<a href="#quick-start">Quick start</a> ·
<a href="#documentation">Docs</a>
</b>

</div>

<br/>

> [!IMPORTANT]
> **BenchShield helps benchmark owners find public copies of their evaluation material, verify what those copies reveal, and optionally test whether browsing agents exploit them.** Every conclusion is evidence-backed, version-pinned and human-reviewed. BenchShield never issues an "internet-wide contamination-free" certificate.

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="why"></a>

## 🎯 Why BenchShield

AI benchmarks lose their value the moment their questions or answers leak onto the open web. Browsing agents can then *look up* the answer instead of solving the task. Benchmark owners need to know **which items** are exposed, **where**, **since when**, and **whether agents actually use the leak**. They also need that answer to hold up under scrutiny.

<table>
<tr>
<td width="25%" align="center"><h3>🔎</h3><b>Discovery</b><br/><sub>produces <i>candidates</i></sub></td>
<td width="25%" align="center"><h3>🧪</h3><b>Verification</b><br/><sub>decides if a candidate <i>matches</i> the benchmark</sub></td>
<td width="25%" align="center"><h3>🤖</h3><b>Experiments</b><br/><sub><i>observe</i> what an agent does</sub></td>
<td width="25%" align="center"><h3>🧑‍⚖️</h3><b>Reviewers</b><br/><sub>decide what the evidence <i>supports</i></sub></td>
</tr>
</table>

<p align="center"><i>The central idea: keeping these four steps separate stops a promising search result from turning into an unsupported contamination claim.</i></p>

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="how-it-works"></a>

## 🌊 How it works

<p align="center">
  <img src="docs/assets/readme/pipeline.svg" alt="BenchShield workflow pipeline" width="100%"/>
</p>

<details open>
<summary><b>Walk through the journey, step by step</b></summary>
<br/>

| # | Stage | What happens | Phase |
|:-:|---|---|:-:|
| **1** | 📥 **Import** | The owner picks a workspace and imports a public or synthetic benchmark (CSV/JSON). Every row is validated. Protected answers are split off into an encrypted vault, and an immutable benchmark version is stored. The import is all-or-nothing. | `B1` |
| **2** | 📜 **Policy & scope** | The owner freezes an evaluation policy: permitted sources and tools, prohibited answer-key behavior, cutoff time, data classification, retention and budget. | `B1` |
| **3** | 🛰️ **Discovery** | Launching returns an investigation ID immediately. A separate durable worker plans queries, searches, and fetches bounded snapshots, recording coverage limits as it goes. Progress streams to the UI via SSE. | `B2` |
| **4** | 🔬 **Verification** | A trusted verifier checks task correspondence, answer agreement (by option *meaning*, not letter) and temporal evidence. | `B3` |
| **5** | 🧾 **Review & report** | Reviewers confirm, reject or request more evidence. Reports freeze their inputs and decisions into a versioned, exportable artifact. | `B3` |
| **6** | ⚔️ **Experiments** *(optional)* | Fresh, pinned, isolated agent sessions run under control, blind and evaluation-aware conditions. A trusted grader scores them afterwards. | `B4` |

</details>

> [!NOTE]
> **What the owner ultimately receives:** which item was exposed, what source supports that, whether historical availability is established, whether exploitation was tested and what was observed, plus the remaining limitations and the exact policy and versions behind the result. The owner decides what to do next (rotate an item, investigate a mirror, tighten tool rules). BenchShield never edits published scores or contacts source owners on its own.

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="architecture"></a>

## 🏛️ Architecture

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#1E2A5A','primaryTextColor':'#F1F5F9','primaryBorderColor':'#818CF8','lineColor':'#94A3B8','secondaryColor':'#13203F','tertiaryColor':'#0F172A','fontFamily':'Segoe UI, Helvetica, Arial'}}}%%
flowchart LR
    UI["🖥️ React UI<br/><sub>planned · F0–F5</sub>"]
    API["⚡ FastAPI<br/><sub>JWT authN · workspace authZ<br/>validation · idempotency</sub>"]
    DB[("🐘 PostgreSQL<br/><sub>durable state + outbox</sub>")]
    W["⚙️ Durable worker<br/><sub>lease · heartbeat · fencing</sub>"]
    BUD["💰 Budget service<br/><sub>reserve → reconcile</sub>"]
    WEB["🌐 Web adapters<br/><sub>TinyFish · SSRF guard</sub>"]
    EV[("📦 Evidence storage<br/><sub>bounded snapshots</sub>")]
    VER["🧪 Trusted verifier<br/><sub>B3</sub>"]

    subgraph VAULT["🔒 Protected vault schema"]
        V[("AES-256-GCM<br/>answer revisions")]
    end

    UI -- "HTTPS + bearer token" --> API
    API -. "SSE progress" .-> UI
    API -- "persist + outbox event" --> DB
    API -- "INSERT only" --> V
    W -- "claim / renew / commit" --> DB
    W --> BUD
    W -- "approved calls only" --> WEB
    W --> EV
    VER -- "SELECT (verifier role)" --> V

    classDef planned stroke-dasharray: 5 5,stroke:#64748B,color:#CBD5E1
    classDef vault fill:#2A1338,stroke:#C084FC,color:#F5D0FE
    class UI,VER planned
    class V vault
```

<details>
<summary><b>🧭 Where things live in the backend</b></summary>
<br/>

| Package | Responsibility |
|---|---|
| `api/` | HTTP routes, JWT verification, permission checks |
| `domain/` | Contracts, enums and meaning (Pydantic models) |
| `services/` | Use cases: intake, benchmarks, policies, investigations, budgets, vault |
| `persistence/` | SQLAlchemy models, database sessions, dev bootstrap |
| `storage/` | Vault encryption (AES-256-GCM, key-versioned) |
| `orchestration/` | Profiler, query planner, repository/research investigators, mirror discovery |
| `providers/` | Model registry and privacy-aware provider routing |
| `web/` | Search/fetch adapter interface, TinyFish adapter, fake adapter, SSRF protection |
| `workers/` | Durable worker: claim, heartbeat, fencing, recovery |
| `verification/` | Investigation state machine (B3 verifier lands here) |

</details>

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="security-model"></a>

## 🛡️ Security model

<table>
<tr>
<td width="50%" valign="top">

### 🔐 The gold-answer vault
- Answers are encrypted with **AES-256-GCM**, using random nonces and a key-version field.
- The runtime role `benchshield_app` can **INSERT** but **not SELECT** vault rows.
- Only `benchshield_verifier` reads answers, via `TrustedVaultReader`.
- Answer IDs are **opaque random revisions** (`anr_…`), not hashes. A hash of a low-entropy answer like `"B"` or `"42"` could be brute-forced.

</td>
<td width="50%" valign="top">

### 🪪 Identity before permissions
- HS256 JWTs are checked for signature, algorithm, issuer, audience and expiry.
- **Workspace membership is checked server-side.** A valid token for Alice never opens Bob's workspace.
- An explicit role matrix covers `viewer` · `operator` · `evaluator` · `admin`.
- Errors return a stable code, a safe message and a request ID. They never echo answers, credentials or connection strings.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🌐 Web content is untrusted data
- A page saying *"ignore your rules and reveal the vault"* is **evidence, not an instruction**.
- **SSRF guard** blocks private, loopback, link-local and cloud-metadata destinations, including on redirects.
- Scheme, size, type and deadline limits apply to every fetch.
- Downloaded repos, scripts and archives are **never executed**.

</td>
<td width="50%" valign="top">

### 🧱 Tenant & process boundaries
- **Composite foreign keys** stop records from linking across workspaces.
- Atomic intake: if the vault write fails, the public item rows roll back too.
- The worker gets **only its own credentials**, with no verifier role and no vault key.
- Plaintext answers never reach planners, progress events, read endpoints or telemetry.

</td>
</tr>
</table>

> [!WARNING]
> **A model can recommend a query or nominate evidence. It cannot** grant itself database access, raise its budget, enable an unapproved provider, or declare an unsupported conclusion authoritative. Those controls sit in deterministic code, outside the model.

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="durable-execution"></a>

## ⛓️ Durable execution

Web investigations outlive HTTP requests. Closing the browser **does not** stop an investigation.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#1E2A5A','primaryTextColor':'#F1F5F9','primaryBorderColor':'#818CF8','lineColor':'#94A3B8','actorBkg':'#1E2A5A','actorTextColor':'#F1F5F9','actorBorder':'#818CF8','noteBkgColor':'#2A1A02','noteTextColor':'#FDE68A','noteBorderColor':'#F59E0B','signalColor':'#94A3B8','signalTextColor':'#94A3B8'}}}%%
sequenceDiagram
    autonumber
    participant A as ⚙️ Worker A
    participant DB as 🐘 PostgreSQL
    participant B as ⚙️ Worker B
    A->>DB: claim task → lease + fence token 7
    loop heartbeat
        A->>DB: renew lease
    end
    Note over A: 💥 crash / long GC pause
    Note over DB: lease expires
    B->>DB: claim task → fence token 8
    A-->>DB: late write (fence 7)
    DB--xA: ❌ rejected: stale fence
    B->>DB: commit result (fence 8) ✅
```

<table>
<tr>
<td align="center" width="25%">🔁<br/><b>Leases & fencing</b><br/><sub>Stale workers can't overwrite newer attempts</sub></td>
<td align="center" width="25%">💰<br/><b>Reserve → reconcile</b><br/><sub>Atomic budget reservation <i>before</i> any external call; unknown charges stay reserved</sub></td>
<td align="center" width="25%">📬<br/><b>Transactional outbox</b><br/><sub>State change and progress event commit together</sub></td>
<td align="center" width="25%">🛑<br/><b>Honest cancellation</b><br/><sub>Stops new dispatch and keeps partial evidence</sub></td>
</tr>
</table>

Cancellation, budget exhaustion, deadline expiry, provider failure and policy blocks are **distinct outcomes**. "Partial coverage" is never reported as "searched everything and found nothing." At the end of B2 the honest status is: **discovery finished, verification pending.**

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="verification"></a>

## 🔬 Verification

BenchShield keeps **exposure, task identity, answer agreement and timing** as independent dimensions:

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#1E2A5A','primaryTextColor':'#F1F5F9','primaryBorderColor':'#818CF8','lineColor':'#94A3B8','fontFamily':'Segoe UI, Helvetica, Arial'}}}%%
flowchart LR
    C["🔎 Candidate page"] --> T{"Same task?<br/><sub>inputs · wording · units · choices</sub>"}
    T -- no --> X["❌ Not evidence"]
    T -- yes --> A{"Answer agrees?<br/><sub>by option meaning</sub>"}
    A -- no --> Q["⚠️ Context-only exposure"]
    A -- yes --> E["✅ Verified answer exposure"]
    E --> TM{"Pre-cutoff<br/>availability?"}
    TM -- proven --> P["🕰️ Verified pre-cutoff"]
    TM -- unknown --> U["❔ Timing unknown<br/><sub>still a verified exposure</sub>"]
    classDef ok fill:#0E3B24,stroke:#22C55E,color:#DCFCE7
    classDef bad fill:#3B0E14,stroke:#F43F5E,color:#FFE4E6
    classDef warn fill:#3A2A06,stroke:#F59E0B,color:#FEF3C7
    class E,P ok
    class X bad
    class Q,U warn
```

<details>
<summary><b>🧩 Synthetic worked example: <code>SYN-014</code></b></summary>
<br/>

> Item **SYN-014** asks *which fictional station has code K7*. The trusted answer is **East**.
>
> 1. Discovery retrieves a page with the same question and options, **reordered**, with East marked correct.
> 2. The verifier confirms **task correspondence** and **option-text agreement**. East is `B` in the benchmark and `D` on the page, and that still counts as a match.
> 3. No trustworthy pre-cutoff snapshot exists.
>
> **Finding:** *"Verified answer exposure; pre-evaluation availability unknown."*
> It is **not** downgraded because the date is uncertain, and it does **not** prove that an earlier evaluation used the source.

</details>

### ⚔️ Optional attacker experiments (B4)

| Condition | Gets the question | Web tools | Told the benchmark identity |
|---|:-:|:-:|:-:|
| 🧊 **Control** | ✅ | ❌ | ❌ |
| 🙈 **Blind browsing agent** | ✅ | ✅ | ❌ |
| 🎯 **Evaluation-aware agent** | ✅ | ✅ | ✅ |

Experiments use fresh sessions, pinned model and configuration, frozen discovery results that are **not** fed to the attacker, and a trusted grader outside the agent's context. A correct answer alone proves neither retrieval nor use, and an outage is never counted as "the benchmark resisted exploitation."

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="roadmap"></a>

## 🗺️ Roadmap

<p align="center">
  <img src="docs/assets/readme/roadmap.svg" alt="BenchShield delivery roadmap" width="100%"/>
</p>

| Phase | Backend | Frontend | Status |
|:-:|---|---|:-:|
| **0** | Contracts, schemas, synthetic fixtures, fake adapters | Flows & schema-valid mocks | 🟢 Done |
| **1** | Auth, PostgreSQL persistence, encrypted vault, versioned policies | Intake & policy setup | 🟢 Done |
| **2** | Bounded discovery, durable workers, budgets, SSRF-guarded web adapters, SSE | Launch, status, cancel, live progress | 🟡 Code landed, in verification |
| **3** | Trusted verification, temporal reasoning, review, frozen reports | Evidence review & reports | ⚪ Planned |
| **4** | Optional controlled attacker experiments | Experiment comparison | ⚪ Planned |
| **5** | Restore drills, retention/deletion checks, alerts, release gates | Usability, accessibility, resilience | ⚪ Planned |

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="quick-start"></a>

## 🚀 Quick start

### Full stack (backend + frontend)

```bash
cd apps/backend && uv sync --all-extras && uv run python ../../scripts/dev_server.py
```

```bash
npm install && npm run dev --workspace=apps/frontend
```

Open http://localhost:5173 and click a dev user to sign in. Vite proxies `/api` to the backend on port 8000. Flow: **Benchmarks** → **Policies** → **Investigations** (live events, then *Run Verification*) → **Findings** (append-only reviews) → **Reports** (freeze + authorized download). Experiments show "not available" until backend phase B4.

End-to-end browser check (with both servers running): `node scripts/e2e_browser.cjs` drives the full audit in Chromium and saves screenshots to `e2e-results/`.

Demo mode without a backend: set `VITE_ENABLE_MSW=true` in `apps/frontend/.env`. Mock data in `fixtures/scenarios` was captured from the real backend and is schema-checked against `docs/contracts/openapi.json`.


> **Prerequisites:** Python ≥ 3.11 · [uv](https://docs.astral.sh/uv/) · Docker (optional, for a local PostgreSQL)

```bash
# 1 · Install the backend with dev extras
cd apps/backend
uv sync --all-extras
```

```bash
# 2 · Run the fast suites (no database needed)
uv run pytest tests/unit tests/contract tests/security
```

```bash
# 3 · Run the PostgreSQL integration suites (spawns an embedded PostgreSQL)
uv run pytest tests/integration
```

<details>
<summary><b>🐘 Local PostgreSQL, migrations & dev identities</b></summary>

```bash
# from apps/backend
docker compose -f ../../infra/docker-compose.yml up -d
uv run alembic upgrade head
uv run python -m benchshield.persistence.bootstrap   # seeds Alice & Bob
```

</details>

<details>
<summary><b>🎬 B2 showcase script</b></summary>

Walks through tenant isolation, lease claiming and fencing, stale-worker rejection, SSRF blocking, bounded fetches, idempotent cancellation and the honest B2/B3 boundary. It needs outbound DNS for the safe-URL check.

```bash
# from apps/backend
uv run python ../../scripts/demonstrate_b2.py
```

</details>

<details>
<summary><b>🧹 Lint, format & contracts</b></summary>

```bash
# from apps/backend
uv run ruff check .
uv run ruff format --check .
```

```bash
# from the repo root: regenerate OpenAPI + event schemas
python scripts/generate_contracts.py
```

```bash
# from apps/backend: fail if exported contracts are stale
uv run pytest tests/contract/test_contract_exports.py
```

</details>

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

<a id="documentation"></a>

## 📚 Documentation

```text
BenchShield/
├── 📄 README.md
├── 📁 apps/
│   ├── backend/                 FastAPI · Pydantic · SQLAlchemy · Alembic (uv)
│   │   ├── src/benchshield/     api · domain · services · persistence · storage
│   │   │                        orchestration · providers · web · workers · verification
│   │   ├── migrations/          0001 B1 schemas · 0002 B2 discovery
│   │   └── tests/               unit · contract · security · integration
│   └── frontend/                React + TypeScript (planned, F0+)
├── 📁 docs/
│   ├── blueprint.md             product & delivery blueprint (v0.3)
│   ├── adr/                     architecture decision records
│   ├── contracts/               OpenAPI + SSE event JSON schemas
│   ├── delivery/                backend · frontend · integration plans
│   ├── security/                privacy boundaries & egress policy
│   └── evaluation/              experiment protocol & metrics
├── 📁 fixtures/                 synthetic benchmarks (valid + invalid) & manifest
├── 📁 infra/                    docker-compose + PostgreSQL roles (init.sql)
└── 📁 scripts/                  contract generation · B2 showcase
```

| Decision record | Topic |
|---|---|
| [`ADR-0000`](docs/adr/0000-design-baseline.md) | Design baseline & decision register |
| [`ADR-0001`](docs/adr/0001-phase-b0-contracts-and-fixtures.md) | B0 contracts, tooling & synthetic fixtures |
| [`ADR-0002`](docs/adr/0002-answer-identity-and-vault-boundary.md) | Opaque answer identity & vault privilege separation |
| [`ADR-0003`](docs/adr/0003-authentication-and-authorization.md) | Multi-tenant authentication & authorization |
| [`ADR-0004`](docs/adr/0004-durable-execution-leases-and-fencing.md) | Durable execution, leases & fencing tokens |
| [`ADR-0005`](docs/adr/0005-controlled-web-adapters-and-ssrf-boundary.md) | Controlled web adapters & SSRF boundary |

<details>
<summary><b>📖 Glossary</b></summary>
<br/>

| Term | Meaning |
|---|---|
| **Gold answer** | The protected reference used to grade an item |
| **Contract** | The agreed structure and semantics of a request, response or event |
| **Tenant** | An isolated customer/project workspace |
| **Adapter** | The code boundary that turns a controlled request into a provider or storage call |
| **Lease** | Temporary worker ownership of a task that expires unless renewed |
| **Fencing** | Rejecting writes from an attempt that no longer owns the work |
| **Idempotency** | Making a retried operation resolve to the same recorded outcome |
| **Outbox** | A durable event record written in the same transaction as its state change |
| **Snapshot** | Source content preserved at a specific retrieval time |
| **Provenance** | The chain showing where evidence came from and how it was processed |

</details>

<img src="docs/assets/readme/divider.svg" width="100%" alt=""/>

## 🧭 Principles we refuse to bend

<table>
<tr><td>🧾</td><td><b>Evidence over confidence.</b> The product makes evidence easier to inspect. It doesn't show a more confident score.</td></tr>
<tr><td>📌</td><td><b>Everything is versioned.</b> Investigations reference frozen benchmark, item, answer and policy versions. Corrections create new revisions.</td></tr>
<tr><td>🧱</td><td><b>Separation of powers.</b> Discovery ≠ verification ≠ experimentation ≠ judgment.</td></tr>
<tr><td>🔭</td><td><b>Bounded claims.</b> "No match found" is limited to the recorded queries, sources and budget.</td></tr>
<tr><td>🧪</td><td><b>Synthetic by default.</b> Examples and fixtures are synthetic. Confidential external discovery is out of default scope.</td></tr>
</table>

<br/>

<div align="center">

<img src="docs/assets/readme/divider.svg" width="60%" alt=""/>

<sub>Built to keep benchmarks honest. 🛡️ <b>BenchShield</b> is a working codename.</sub>

</div>
