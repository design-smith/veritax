# Runtime Tool Registry Contract

Source: `DEMO-PRD/PRD-05-runtime.md` section 4.

This batch covers:

- tool registry table shape
- capability class enum
- scope requirements
- sensitivity ceiling
- cost weight
- rate limits
- deploy-time registration
- v1 Record read tools
- v1 retrieval search tool
- v1 blob read tool
- v1 engine tools
- v1 staging put tool
- v1 export prepare tool
- no-egress tool class guardrail

The runtime publishes the deploy-time v1 catalog through `listTools()` and lookup through `getTool({ name })`.

Each registered tool declares:

- `name`
- `capabilityClass`
- `scopeRequirements`
- `sensitivityCeiling`
- `costWeight`
- `rateLimits`
- `registeredBy`

`authorizeToolUse(command)` enforces tool rate limits after the derived-authority checks pass. Denied authorization attempts do not consume a slot. Allowed calls consume one tenant-scoped tool authorization slot at `requestedAt`.

Rate-limit windows:

- `perMinute`: maximum allowed authorizations for the tenant/tool in the trailing 60 seconds
- `burst`: maximum allowed authorizations for the tenant/tool in the trailing 1 second

When either window is exhausted, authorization returns `allowed: false` with `reason: "tool_rate_limited"`.

Allowed capability classes are:

- `read`
- `engine-call`
- `staging-write`
- `export-prepare`

Allowed sensitivity ceilings are:

- `public`
- `internal`
- `confidential`
- `privileged-vault`

The v1 catalog is:

- `record.get`
- `record.subgraph`
- `record.conflicts`
- `record.timeline`
- `record.current_value`
- `retrieval.search`
- `blob.read`
- `engine.range_test`
- `engine.globe_check`
- `engine.cascade_traversal`
- `staging.put`
- `export.prepare`

`registerTool(command)` accepts deploy-time registrations only. Runtime registration is rejected because agents cannot mint new capabilities while running.

There is no egress capability class. Outward actions remain outside the sandbox; `export.prepare` only prepares an export request for human release.
