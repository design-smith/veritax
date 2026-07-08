# Runtime Derived Authority Contract

Source: `DEMO-PRD/PRD-05-runtime.md` section 6.

This batch covers:

- derived authority intersection
- initiator capability map input
- job-kind tool-set enforcement
- declared job scope enforcement
- initiator scope enforcement
- tool scope requirement checks
- sensitivity ceiling checks
- privileged-vault absence semantics

The runtime does not decide policy. PRD-13 remains the source of each principal's capability map. The runtime consumes that map at tool-use time and intersects it with the stored job.

Effective authority for a tool use is:

- the tool exists in the deploy-time registry
- the job kind can use the tool's capability class
- the initiator capability map contains the tool's capability class
- the requested scope satisfies the tool's scope requirements
- the requested scope is inside the job's declared scope
- the requested scope is inside the initiator capability map
- the requested sensitivity is at or below the tool sensitivity ceiling
- the requested sensitivity is at or below the initiator sensitivity ceiling

`authorizeToolUse(command)` returns a structured authorization result:

- `allowed`
- `reason`
- `tool`
- `effectiveScope`

Denial reasons are stable strings intended for runners and diagnostics:

- `tool_not_registered`
- `tool_not_allowed_for_job_kind`
- `capability_missing`
- `scope_requirements_not_met`
- `scope_outside_job`
- `scope_outside_initiator`
- `sensitivity_exceeds_tool`
- `sensitivity_exceeds_capability`

`listAvailableToolsForJob(command)` returns only tools visible to the job under the live capability map. Privileged-vault tools are omitted for non-vault capability maps. Direct authorization can still explain an explicit denied request, but discovery follows the PRD rule: privileged-vault refs are absent, not merely disabled.

Default job-kind tool sets are:

- `agent`: `read`, `engine-call`, `staging-write`
- `engine`: `engine-call`
- `pipeline`: `read`, `engine-call`, `staging-write`, `export-prepare`
- `composite`: no direct tool use; child jobs use tools under their own kind and scope
