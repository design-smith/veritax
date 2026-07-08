# Runtime Safety Contract

Source: `DEMO-PRD/PRD-05-runtime.md` sections 10 and 11.

This batch covers:

- tenant kill switches
- job-kind kill switches
- tool circuit breakers
- circuit-aware tool discovery and authorization
- gate request-changes mechanics

Kill switches halt scheduling only. New job submission, plan approval, and transition to `running` are blocked while an active tenant or job-kind switch applies. Runs that were already `running` are not mutated by the switch and may continue through staging, completion, cancellation, or failure.

Circuit breakers are configured per tenant and tool. Retryable `tool_error` and `timeout` failures recorded with a `toolName` count against the configured rolling window. When the threshold is reached, the breaker opens, the tool is removed from discovery, and explicit authorization returns `tool_circuit_open`.

Gate request-changes is a runtime control path, not a Record promotion or rejection. It logs anchored comments, leaves the Record gate undecided, and returns the run from `awaiting-gate` to `producing` so the producer can revise the staged output.
