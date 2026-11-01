# ADR 0004: Durable Execution, Leases, and Distributed Fencing Tokens

## Status
Accepted

## Context
In BenchShield Phase B2, benchmark exposure investigations must reliably discover public candidate evidence while surviving worker restarts, node failures, network timeouts, and variable-length retrieval delays. Without a durable job coordination model:
1. Long-running discovery jobs can be lost or left in orphaned states if worker processes crash or restart.
2. Concurrent workers attempting to pick up tasks can suffer race conditions or duplicate execution.
3. A stalled or partitioned worker (e.g. during an extended garbage collection pause or slow network fetch) whose lease expired could wake up and commit stale results over a task already reassigned to and completed by another worker (the classic split-brain zombie worker problem).

## Decision

We implement a PostgreSQL-native durable task execution system with:
1. **Relational Queueing via `SELECT ... FOR UPDATE SKIP LOCKED`**:
   - Workers query pending or expired investigation tasks using PostgreSQL row-level locks, allowing lock-free concurrent task claiming without Celery or Redis.
2. **Explicit Heartbeats and Lease Expiry**:
   - Each claimed task carries a `lease_expires_at` timestamp. Active workers extend the lease via regular heartbeats before external provider calls. If a worker crashes, the lease expires and the task automatically becomes reclaimable.
3. **Monotonic Fencing Tokens**:
   - Every time a task is claimed or reclaimed, its integer `fencing_token` is incremented.
   - When a worker finishes processing and attempts to commit candidate evidence, the persistence layer strictly verifies:
     ```sql
     SELECT fencing_token FROM investigation_tasks WHERE id = :task_id FOR UPDATE;
     ```
   - If `task.fencing_token != worker.fencing_token`, the commit is rejected with `StaleTaskCommitError`. This prevents late or superseded workers from overwriting fresher state or reviving cancelled tasks.
4. **Honest B2/B3 Phase Boundary**:
   - Evidence records discovered in Phase B2 are committed exclusively with `status = 'candidate'`.
   - Investigations finish with `substatus = 'discovery_completed_pending_verification'`.
   - Exposure verification, answer grading, and human reviewer workflows remain strictly reserved for Phase B3.

## Consequences

### Positive
- Fully ACID-compliant job coordination without adding external message broker dependencies (Redis, RabbitMQ, Celery).
- Complete immunity against split-brain zombie worker overwrites.
- Full visibility into task attempt histories (`task_attempts`) and execution logs.
- Preserves partial candidate evidence on user cancellation or timeout without data loss.

### Negative / Trade-offs
- PostgreSQL table throughput is bound by database write performance; suitable for bounded evaluation batches (up to tens of thousands of items per batch) rather than high-throughput streaming queues.

