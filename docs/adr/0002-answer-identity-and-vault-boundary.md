# ADR-0002: Protected Answer Revision Identity and Vault Privilege Separation

## Context
During the Phase B0 corrective inspection, an enumeration vulnerability was identified in answer revision identification. The earlier draft implementation hashed the workspace ID, external item ID, and answer text with a static salt to derive `answer_binding_version`. Because benchmark questions and candidate choices often have low entropy (e.g. choice "A", integer "42", or short country names), an adversary could precalculate candidate hashes, compare them with public binding identifiers, and reconstruct the reference answer without accessing the vault.

Additionally, BenchShield's core privacy guarantee requires that reference answers are never exposed to public consumers, operational progress events, standard logging, or general application queries. Even when an application database credential is compromised, reference answers must remain protected.

## Decisions

### 1. Opaque Random Answer Revision Identity
- Replaced public answer-derived identifiers with opaque, randomly allocated revision IDs formatted as `anr_<uuid4_hex[:16]>`.
- The revision ID is generated during intake by the trusted persistence layer.
- **Enumeration Resistance**: Because revision IDs are cryptographically random and decouple identity from answer content, an attacker cannot compute candidate hashes or enumerate candidate answers.
- **Audit Lineage**: Public `ItemVersion` records retain `answer_revision_id`, guaranteeing an exact reference to the vaulted gold answer without exposing answer length, entropy, or content.
- Changing an answer during subsequent benchmark imports allocates a new opaque `answer_revision_id` and binds it to a new immutable item version and benchmark version.

### 2. Multi-Schema Database Architecture with Privilege Separation
- BenchShield employs a multi-schema PostgreSQL structure:
  - `public`: Stores general operational metadata: workspaces, users, memberships, benchmark metadata, immutable benchmark versions, immutable item versions, evaluation policies, audit events, and idempotency records.
  - `vault`: Stores sensitive reference answers in `vault.protected_answers`.
- Three distinct database roles enforce boundary privileges:
  1. `benchshield_owner`: DDL migration role with schema creation and migration ownership.
  2. `benchshield_app`: General application runtime role. Possesses `SELECT, INSERT, UPDATE, DELETE` on `public` schema tables, but **strictly `INSERT ONLY`** on `vault.protected_answers`. `SELECT` privilege on the vault is explicitly revoked.
  3. `benchshield_verifier`: Evaluation verifier role. Possesses restricted read access (`SELECT`) to `vault.protected_answers` and `public` items for offline or trusted grading pipelines.

### 3. Authenticated Encryption at Rest (AES-256-GCM)
- Every vaulted reference answer is encrypted prior to database insertion using AES-256-GCM with authenticated tags and random 12-byte initialization vectors (nonces).
- Key versioning (`v1`) is encoded in database columns to support future zero-downtime key rotation.
- Plaintext answers exist in memory only during intake validation and within the isolated verifier execution context.

### 4. Trusted Vault Reader Interface
- Application request handlers and general services cannot access `TrustedVaultReader`.
- Only evaluation verification routines instantiated with `benchshield_verifier` credentials can read and decrypt vaulted answers.

## Consequences

### Positive
- Candidate enumeration and dictionary attacks against public item identifiers are structurally impossible.
- Compromise of standard `benchshield_app` database credentials does not grant read access to reference answers.
- Clear separation between public benchmark metadata and vaulted grading references.
- All 58 unit, contract, security, and real database integration tests verify these boundaries.

### Negative / Trade-offs
- An additional database role and connection pool (`database_verifier_url`) must be maintained in environments running verification jobs.
- Re-importing identical answers does not produce deterministic hashes; deduplication is handled via explicit idempotency keys and internal content hashing rather than public identities.
