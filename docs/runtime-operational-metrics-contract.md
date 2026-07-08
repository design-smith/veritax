# Runtime Operational Metrics Contract

Source: `DEMO-PRD/PRD-05-runtime.md` section 14.

This batch adds `getOperationalMetrics(command)`, a read-only PRD-15-facing runtime summary built from real runtime state.

The metrics include:

- plan fidelity: approved plans and the share approved after an edit/recompile
- trace completeness: completed executable runs with at least one recorded step
- gate latency: requested gates, decided gate latency p50/p95, escalated gate count, and escalation rate
- cost by class: aggregate final job meters grouped by runtime cost class
- watcher orphaning: orphan occurrences, reassignment count, and average reassignment time
- kill-switch drill status: latest enabled drill switch inside the configured window
- canonical write guard: runtime-owned outside-promote-path violations, currently always zero by construction

Gate latency is derived from runtime `gate.requested`, `gate.decided`, and `gate.escalated` events, not from UI state.

Cost by class uses final job meters rather than cumulative telemetry entries so multi-step jobs are not double-counted.

Watcher orphan resolution is recorded when an orphaned schedule is reassigned. Current orphaned schedules plus resolved orphan records form the total orphan count.

The API is tenant-scoped and accepts `asOf` plus `killSwitchDrillWindowDays` for reproducible drill-window checks.
