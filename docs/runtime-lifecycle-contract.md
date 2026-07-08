# Runtime Lifecycle Contract

Source: `DEMO-PRD/PRD-05-runtime.md` sections 4, 7, 9, 11, and 12.

This batch extends the v0 Runtime service with trace persistence and lifecycle transitions:

- `recordStep(command)`
- `transitionJob(command)`

`recordStep` appends immutable per-step trace records to a tenant-scoped run. Step records use the PRD shape:

- `stepId`
- `type`: `tool`, `engine`, `model`, or `subjob`
- `argsRef`
- `resultRef`
- `t0`
- `t1`
- `cost`

Model steps must also carry `modelIO`:

- `promptRef`
- `outputRef`
- `retentionClass`

The runtime currently supports two PRD-14-aligned model I/O retention classes: `batch-6-months` and `gate-adjacent-24-months`. A `model` step without `modelIO` is refused, and non-model steps cannot carry model I/O refs.

`transitionJob` enforces the Runtime lifecycle:

- `queued` can move to `planning` or `cancelled`
- `planning` can move to `running`, `failed`, `cancelled`, or `budget-exceeded`
- `running` can move to `producing`, `failed`, `cancelled`, or `budget-exceeded`
- `producing` can move to `awaiting-gate`, `completed`, `failed`, `cancelled`, or `budget-exceeded`
- `awaiting-gate` can move to `completed`, `failed`, `cancelled`, or `budget-exceeded`
- `completed`, `failed`, `cancelled`, and `budget-exceeded` are terminal

Failure details are stored only for terminal failure states. `failed` requires a typed failure detail other than `budget`; budget failures use `budget-exceeded`.

Trace completeness is a completion hard gate. A non-composite run cannot transition to `completed` unless at least one `recordStep(command)` trace exists on the run. Composite parent runs are exempt because they aggregate child run state rather than executing direct tool or engine steps themselves.
