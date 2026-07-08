# Runtime Retry And Staging Contract

Source: `DEMO-PRD/PRD-05-runtime.md` section 4.

This batch covers:

- retry policy by failure class
- tool transient retry with backoff
- validation no-retry behavior
- refusal no-retry behavior
- poison queue persistence
- poison queue Runs surface contract
- idempotent staging write deduplication

`recordFailure(command)` applies the runtime failure policy:

- `tool_error` retries with exponential backoff.
- `timeout` retries once with backoff.
- `validation`, `refusal`, `conflict`, and `budget` do not retry.
- Retry-exhausted retryable jobs move to failed and receive a poison queue entry.

`listPoisonQueue({ tenantId })` exposes poisoned runs with failure detail, retry attempts, diagnostics, and parked time so the Runs surface can show diagnostics instead of losing the job.

`recordStagingWrite(command)` persists staging writes only while a job is `producing`. The dedupe key is:

- tenant
- job
- idempotency key
- output ref

Replaying the same idempotency key and output ref returns the first staging write. A different output ref creates a separate staging write, even with the same idempotency key.

A different idempotency key for an output ref that already has a staged proposal is not a replay; it is a staging collision. The runtime does not let the newer staged object win. It moves the run to `failed` with failure class `conflict`, points the failure detail at the existing staging-conflict ref, emits `run.failed`, and leaves the original staged write as the only persisted proposal for that output.
