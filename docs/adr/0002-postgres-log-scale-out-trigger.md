# ADR 0002: Postgres Log Scale-Out Trigger

Status: Accepted

Date: 2026-06-19

Source: `DEMO-PRD/PRD-02-record.md` sections 12 and 15.

## Decision

Postgres remains the authoritative event log through v1. A dedicated log service is reviewed when a tenant reaches 10,000,000 events, using measured operational evidence rather than a speculative migration.

## Consequences

- Event log partitioning starts by tenant.
- Derived graph or vector stores stay disposable and rebuildable.
- The service exposes partition statistics and a scale-out review flag.
- A dedicated event-store product is not introduced before the trigger is reached.
