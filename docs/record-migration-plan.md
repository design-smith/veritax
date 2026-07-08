# Record Migration Plan

Source: `DEMO-PRD/PRD-02-record.md` section 13.

## v0

Wave 0 keeps the Record foundation live in the demo: hash-chained event log, assertions with provenance, staging and single-approver gates, direct dependency staleness propagation, lens shapes, and single-tenant RLS scaffolding.

## v1

Wave 1 hardens bitemporal and governance behavior: reconstruction reads, period sealing, manifest replay, precedence policy configuration, async staleness propagation, and multi-tenant RLS enforcement.

## v2

Wave 2 is the scale and retention pass: partition strategy hardening, dedicated log-service review at 10M events per tenant, sealed snapshot cadence review, and crypto-shredding field hooks aligned with PRD-14.
