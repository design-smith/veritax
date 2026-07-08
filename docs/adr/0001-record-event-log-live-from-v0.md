# ADR 0001: Record Event Log Live From v0

Status: Accepted

Date: 2026-06-19

Source: `DEMO-PRD/PRD-02-record.md` sections 5, 6, and 13.

## Decision

The Record service owns a hash-chained, insert-only event log from v0. Canonical projections may remain relational and transactional, but the event log is live from day one and is the authoritative replay source for the record.

## Consequences

- Record writes go through Record service commands.
- Every domain write appends events and enqueues the same-database outbox.
- Bitemporal reconstruction reads can arrive in v1 without a later event-sourcing retrofit.
- Read and access audit events stay out of the domain event log.
