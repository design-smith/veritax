"""Invoice evidence (Class 2 §26): transaction-EXISTENCE facts (issuer/recipient/amount/number/date/description),
properly scoped, document-sourced. These carry NO far_type, so they are NOT functional facts and cannot
establish a functional profile, risk control, or arm's-length pricing (§26) — they only support that a
transaction existed, its direction/counterparty, amount, and timing.
"""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from .extraction_store import ExtractedFactInput, FactSourceInput, RunInput, add_extracted_fact, create_extraction_run

_SCHEMA_VERSION = "2026-08-16"
# fact_type, value_type, scope_level, field-name
_FIELDS = [
    ("invoice_issuer", "text", "counterparty", "issuer"),
    ("invoice_recipient", "text", "counterparty", "recipient"),
    ("invoice_amount", "number", "transaction", "amount"),
    ("invoice_number", "text", "transaction", "number"),
    ("invoice_date", "text", "transaction", "date"),
    ("invoice_description", "text", "transaction", "description"),
]


async def ingest_invoice(session: AsyncSession, engagement_id: uuid.UUID, *, document_id: uuid.UUID,
                         issuer: str | None = None, recipient: str | None = None, amount: float | None = None,
                         currency: str | None = None, date: str | None = None, number: str | None = None,
                         description: str | None = None, agreement_ref: str | None = None) -> int:
    """Create transaction-existence facts for one invoice (document-sourced). Returns facts created."""
    values = {"issuer": issuer, "recipient": recipient, "amount": amount,
              "number": number, "date": date, "description": description}
    present = [(ft, vt, sc, values[field]) for ft, vt, sc, field in _FIELDS if values[field] not in (None, "")]
    if not present:
        return 0
    quote = f"Invoice {number or ''}: {issuer or '?'} -> {recipient or '?'} {amount or ''} {currency or ''}".strip()
    run = await create_extraction_run(session, RunInput(
        engagement_id=engagement_id, document_id=document_id, schema_key="invoice", schema_version=_SCHEMA_VERSION,
        classification_type="Invoice", classification_version="invoice", runner_version="invoice-ingest-v1",
        model_version="structured", fingerprint=f"inv-{document_id.hex[:16]}-{(number or 'n')[:12]}"[:64],
        status="extracted", active=True))
    created = 0
    for fact_type, value_type, scope_level, val in present:
        await add_extracted_fact(
            session, run.id, document_id,
            ExtractedFactInput(schema_key="invoice", schema_version=_SCHEMA_VERSION, fact_type=fact_type,
                               value_raw=str(val), value_normalized=str(val), value_type=value_type,
                               scope_level=scope_level),   # no far_type → not a functional fact (§26)
            sources=[FactSourceInput(document_id=document_id, locator=f"invoice {number or ''}".strip(), quote=quote)])
        created += 1
    return created
