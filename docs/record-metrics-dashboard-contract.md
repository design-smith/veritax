# Record Metrics Dashboard Contract

Source: `DEMO-PRD/PRD-02-record.md` section 14.

The Record metrics dashboard is a service contract, not a UI screen. `getMetricsDashboard` returns one tenant-scoped snapshot that aggregates:

- release invariant gates
- replay determinism samples
- assertion provenance completeness
- event lag
- staleness propagation latency
- gate decision latency
- tenant isolation canaries
- event-log partition status

The release gate passes only when every blocking metric passes. Replay determinism requires at least one supplied replay sample so the dashboard can compare rendered bytes against the artifact hash and manifest pins.
