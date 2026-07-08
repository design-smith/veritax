# Runtime Gate Escalation Contract

Source: `DEMO-PRD/PRD-05-runtime.md` section 10.

This batch covers automatic gate SLA escalation from the runtime:

- `escalateOverdueGates(command)`
- Record-backed open-gate discovery
- runtime-owned gate filtering
- SLA breach detection
- configured escalation hierarchy
- idempotent sweep replay
- runtime `gate.escalated` events for every escalated gate

`escalateOverdueGates(command)` scans the tenant's Record gates, keeps only gates created by runtime runs, and escalates open gates whose `slaDue` is at or before `asOf`.

Open gate statuses are:

- `pending`
- `delegated`
- `escalated`

Approved and rejected gates are never escalated by the sweep.

The caller supplies `escalationPath`, ordered from the first escalation target to the highest escalation target. The runtime chooses the next target by the gate's existing escalation count. A gate with no remaining target is inspected but not escalated.

Each escalation uses the real Record `escalateGate` command and appends a runtime `gate.escalated` event to the owning run stream. Replaying the same sweep idempotency key returns the first result without adding duplicate Record or runtime events.
