# Runtime Budgets And Model Registry Contract

Source: `DEMO-PRD/PRD-05-runtime.md` section 7.

This batch covers:

- cost-class budget profiles
- per-step metering
- cost telemetry stream for PRD-15
- budget-exceeded cutoff
- manager raise-and-retry
- tenant running-job concurrency guard
- tenant monthly spend guard
- model registry
- model routing policy
- equivalent-eval provider failover
- run model-version pinning

Cost classes carry ceilings:

- `instant`: 0 tokens, 4 tool calls, 1 second wallclock
- `standard`: 250,000 tokens, 40 tool calls, 30 minutes wallclock
- `heavy`: 2,000,000 tokens, 200 tool calls, 2 hours wallclock
- `batch`: 10,000,000 tokens, 1,000 tool calls, 24 hours wallclock

Approved plans copy their plan `costClass` into the run budget. Direct engine and pipeline submissions remain plan-exempt and unclassified unless a later API path assigns a budget.

`recordStep(command)` remains the source of trace truth. It records the step, derives a normalized meter from the step cost and timestamps, updates the run meter, and appends a tenant-scoped cost telemetry entry.

The meter tracks:

- tokens
- tool calls
- engine calls
- model calls
- wallclock milliseconds
- cost weight

If a step crosses the run budget or tenant monthly cost-weight guard, the run moves to `budget-exceeded` with a budget failure. The step and telemetry remain visible so reviewers can see what consumed the budget.

`raiseBudget(command)` requeues a `budget-exceeded` run after manager approval. The new budget must cover the already-spent meter and must increase at least one ceiling. Idempotent replay returns the first result.

Tenant guards are configured with `configureTenantBudgetGuard(command)`:

- `maxConcurrentRunningJobs` blocks transition to `running` when the tenant is already at capacity
- `monthlyCostWeightCeiling` blocks further spend by moving the spending run to `budget-exceeded`

The model registry stores deploy-time models:

- model id
- version
- provider
- capability tags
- cost weight
- eval status ref
- availability

The default routes are:

- `classification`
- `extraction`
- `drafting`
- `investigation`

Small routes use the small classifier/extractor. Drafting and investigation use the large model family.

`configureModelRoute(command)` requires `configuredBy: "prd-15-release-gate"`. This keeps routing policy versioned and release-gated.

`routeModel(command)` returns the preferred available model. If the preferred model is unavailable, failover is allowed only when the fallback model:

- is available
- has the required capability tags
- shares the preferred model's eval status ref

Jobs pin model versions through `pins.modelVersions` at approval. Later availability or route changes do not mutate existing run pins.
