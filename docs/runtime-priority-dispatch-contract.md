# Runtime Priority Dispatch Contract

Source: `DEMO-PRD/PRD-05-runtime.md` sections 4 and 12.

This batch covers:

- worker-facing priority-lane dispatch
- idempotent job claims
- claim leases
- release of unstarted claims back to the queue
- kill-switch-aware dispatch

`claimNextJob` chooses the next queued run from the requested lanes using the runtime priority order: `interactive`, `standard`, `background`, then `batch`. Within a lane, older queued runs dispatch first. Claiming a run moves it from `queued` to `planning` and emits `run.planning`.

`releaseJobClaim` returns an active, unstarted planning run to `queued` and emits `run.queued`. Claims become `started` when the claimed run transitions to `running`; started claims cannot be released back to the queue.

Tenant kill switches block dispatch. Job-kind kill switches remove matching runs from the dispatchable set while allowing other queued kinds to continue.
