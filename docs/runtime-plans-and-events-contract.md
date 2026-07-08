# Runtime Plans And Events Contract

Source: `DEMO-PRD/PRD-05-runtime.md` sections 2, 5, and 12.

This batch adds the durable plan path and observable runtime events:

- `streamRun({ tenantId, jobId, afterEventId? })`
- `compilePlan(command)`
- `editPlan(command)`
- `approvePlan(command)`
- plan-aware `submitJob(command)`

Runtime commands emit immutable `run.*` events into a tenant-scoped run stream. Current event types are:

- `run.queued`
- `run.planning`
- `run.started`
- `run.producing`
- `run.awaiting_gate`
- `run.completed`
- `run.failed`
- `run.cancelled`
- `run.budget_exceeded`
- `run.step`

Plans persist the PRD/PAT-4 preview shape:

- intent restatement
- ordered step previews with scope and tool class
- invalidation preview
- produced-object preview
- estimated duration and cost class
- instruction echo
- permission verdict
- source

Editing a plan creates a new compiled plan and marks the old plan `superseded`. Approval marks a compiled plan `approved`, freezes corpus/rulepack/model pins, and creates a queued job carrying the plan ref.

Engine and pipeline jobs remain plan-exempt. Agentic and composite job submissions require `planRef`.
