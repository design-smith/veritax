# Runtime Scheduler Contract

Source: `DEMO-PRD/PRD-05-runtime.md` sections 5, 6, and 12.

This batch covers:

- `schedule.register(trigger, plan_template, owner)`
- schedule firing into auto-approved plans
- watcher-owned queued runs
- live owner capability checks
- orphan pause and reassignment

Schedules are durable tenant-scoped runtime objects. A schedule stores a trigger, an owner, and a pre-approved plan template. Firing a schedule creates an approved plan with `source.kind = schedule_ref` and a queued watcher job with initiator `watcher:schedule`.

The runtime checks the live owner capability map at fire time. If the owner no longer covers the template entity, jurisdiction, object-ref, or tool-class scope, the schedule is paused into `orphaned` and no plan or job is created. Reassignment requires the new owner capability map to cover the same template scope before the schedule can return to `active`.

Fiscal-year `period` remains plan context, not capability-map scope, because runtime capability maps do not carry a period dimension.
