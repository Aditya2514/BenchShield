# ADR 0005: Controlled Web Adapters and SSRF Boundary Protection

## Status
Accepted

## Context
BenchShield audits public sources for leaked evaluation benchmark items by searching and fetching web pages, repositories, and preprint archives. This external retrieval introduces severe security risks:
1. Server-Side Request Forgery (SSRF) targeting internal VPC resources, cloud metadata APIs (e.g. AWS `169.254.169.254`, GCP `metadata.google.internal`), or local services (`127.0.0.1`, `localhost`).
2. Protocol-level exploits using non-HTTP schemes (`file://`, `gopher://`, `ftp://`).
3. Outbound data leakage if sensitive gold answers or verifier database credentials are inadvertently embedded into search queries or scrape requests.
4. Denial of service from unbounded memory allocation when downloading massive files or binary payloads.

## Decision

We establish a strict, layered boundary around all outbound web interactions:
1. **SSRF Protection Layer (`ssrf_protection.py`)**:
   - Strictly enforces allowed schemes (`http` and `https` only).
   - Validates hostname and performs DNS resolution before dispatch.
   - Blocks all private subnets (RFC 1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local and cloud metadata (`169.254.0.0/16`, `169.254.169.254`, `metadata.google.internal`), multicast, broadcast, and reserved IP ranges.
   - Intercepts and re-validates every intermediate URL in HTTP redirect chains.
2. **Controlled Adapter Interfaces (`SearchAdapter`, `FetchAdapter`)**:
   - Decouples orchestration logic from specific web retrieval engines.
   - Standardizes domain error mappings (`RateLimitExceededError`, `UpstreamTimeoutError`, `ContentSizeLimitExceededError`, `ProviderUnavailableError`).
   - Standardizes evidence output into immutable, typed snapshots (`SearchResultItem`, `FetchSnapshotResult`).
3. **Truncation & Size Ceilings**:
   - Outbound fetches enforce a hard byte ceiling (default 500KB) to prevent unbounded memory buffering.
4. **Data Isolation**:
   - Investigation workers and web adapters operate exclusively with public item versions (`question`, `choices`, allowlisted metadata).
   - Verifier credentials, vault encryption keys, and reference answers never enter web adapter contexts.

## Consequences

### Positive
- Ironclad protection against SSRF attacks against internal infrastructure, VPC services, and cloud metadata.
- Resilient error handling and normalized response types across all web search/scrape providers.
- Bounded memory and network footprint.
- Ready for interchangeable providers (live TinyFish SDK in production, deterministic `FakeWebAdapter` in testing and air-gapped environments).

### Negative / Trade-offs
- Internal intranet sites cannot be scraped directly without explicitly reconfiguring allowlists.
- Fast-changing DNS records (DNS rebinding) require per-hop validation during redirect resolution.

