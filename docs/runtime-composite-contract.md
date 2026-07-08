# Runtime Composite Contract

Source: `DEMO-PRD/PRD-05-runtime.md` sections 4 and 5.

This batch covers the composite job block:

- plan editing granularity decision
- instant engine plan exemption decision
- composite DAG schema
- composite submission
- child job creation
- child dependency-aware dispatch
- blocked-descendant cancellation
- sibling failure continuation
- fail-fast behavior
- composite child manifest aggregation

Plan edits remain full recompiles. A plan edit produces a new compiled plan and marks the previous plan `superseded`; the runtime does not support per-step toggles because the compiler never validated a partial Franken-plan.

Engine and pipeline jobs remain plan-exempt. Agentic and composite jobs require `planRef`.

Composite jobs are submitted with:

- parent `planRef`
- initiator
- scope
- priority lane
- `failFast`
- child jobs keyed by stable DAG key
- child dependencies by key

The runtime validates that child keys are unique, dependencies point at existing children, no child depends on itself, and the dependency graph is acyclic.

Composite submission creates a real parent job plus real child jobs. The parent keeps `composite.manifest`, and `getCompositeManifest` exposes:

- child job ids and dependency edges
- status by child key
- completed child keys
- failed child keys
- cancelled child keys
- terminal state

Composite parent jobs are orchestration records, not direct worker claims. `claimNextJob` only dispatches non-composite jobs, and a composite child is dispatchable only after every child key in its `dependsOn` list has completed.

By default, a failed or otherwise unavailable child cancels only descendants that can no longer satisfy their dependencies; cancellation propagates transitively regardless of child declaration order, while independent siblings remain dispatchable. Once every surviving branch finishes, the parent rolls up to a terminal state. With `failFast: true`, the first failed or budget-exceeded child cancels all unfinished siblings immediately and rolls the parent to a failed terminal state.
