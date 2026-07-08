# Runtime Foundation Contract

Source: `DEMO-PRD/PRD-05-runtime.md` sections 4 and 12.

The v0 Runtime foundation exposes an in-process service contract for the first job-model slice:

- `createRuntimeService()`
- `submitJob(command)`
- `getRun({ tenantId, jobId })`
- `listRuns({ tenantId, status? })`

Jobs are tenant-scoped, idempotent by caller-supplied key, and persisted with a ULID job id, kind, initiator, scope, priority lane, lifecycle status, failure slot, and empty trace step list. Engine and pipeline jobs are plan-exempt at this layer; later batches add plan enforcement for agentic and composite jobs.
