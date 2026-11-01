# ADR-0003: Multi-Tenant Workspace Authorization and Authentication Architecture

## Context
BenchShield is a multi-tenant audit platform. Different research organizations, academic labs, and model vendors evaluate benchmarks within isolated workspaces.

Crucial boundaries must be enforced:
- Client requests must never be trusted based solely on client-supplied headers (e.g. `X-Workspace-ID`).
- Authenticated identities must have verified server-side memberships in target workspaces.
- Fine-grained role permissions must govern read, import, policy creation, and evaluation actions.
- Cross-workspace data access and relationship tampering must be rejected both at the application routing layer and at the database relational boundary.

## Decisions

### 1. Authenticated Actor Verification via Signed JWTs
- All protected operational API routes require an `Authorization: Bearer <token>` header containing a cryptographically signed JSON Web Token (JWT).
- The authentication middleware verifies token signature, HMAC-SHA256 algorithm, issuer, audience, and expiration.
- Unsigned, forged, expired, or missing tokens are rejected immediately with `HTTP 401 Unauthorized` without reading request bodies or invoking database transactions.

### 2. Server-Side Workspace Membership Verification
- Clients provide an `X-Workspace-ID` header specifying the active tenant context.
- For every tenant-scoped operation, the backend verifies membership server-side in PostgreSQL by querying `workspace_memberships` for `(workspace_id, user_id)`.
- If no membership exists, the request is rejected with `HTTP 403 Forbidden` (`User is not a member of workspace`).
- Insecure development shortcuts (e.g. `x-actor-role` headers) are gated by `allow_insecure_auth_shortcuts=False` and are strictly forbidden in staging and production environments.

### 3. Role-Permission Matrix
- Four explicit roles are defined:
  - `viewer`: Read benchmarks and evaluation policies.
  - `operator`: Import benchmarks, create policies, launch investigations.
  - `evaluator`: Read benchmarks, policies, findings, and review evidence.
  - `admin`: Full workspace management, retention administration, and all operational actions.
- Every API route declares explicit permission dependencies (e.g. `require_permission(Permission.IMPORT_BENCHMARK)`).

### 4. Database Engine-Level Tenant Isolation (Composite Foreign Keys)
- Cross-tenant relationship leaks are prevented not only in application code, but also by PostgreSQL engine constraints.
- Multi-tenant tables define composite unique constraints on `(workspace_id, id)`.
- Dependent tables enforce composite foreign keys:
  - `benchmark_versions`: `FOREIGN KEY (workspace_id, benchmark_id) REFERENCES benchmarks (workspace_id, id) ON DELETE CASCADE`.
  - `item_versions`: `FOREIGN KEY (workspace_id, benchmark_version_id) REFERENCES benchmark_versions (workspace_id, id) ON DELETE CASCADE`.
- Attempting to attach an item or version belonging to Workspace B to a benchmark belonging to Workspace A is rejected by PostgreSQL with a foreign key violation.

### 5. Idempotent Bootstrap Procedure
- Development and integration testing environments are seeded via `benchshield.persistence.bootstrap.bootstrap_development_identities`:
  - `usr_alice` (Admin in `ws_alpha`)
  - `usr_bob` (Admin in `ws_beta`)
  - `usr_charlie` (Viewer in `ws_alpha`)
- Seeding is idempotent and uses isolated test databases without affecting production environments.

## Consequences

### Positive
- Strict tenant isolation enforced at both the API boundary and the database relational layer.
- Zero reliance on client-asserted permissions.
- Full test coverage in `tests/integration/test_b1_secure_foundation.py` verifying cross-workspace reads, writes, and composite foreign key rejections.
