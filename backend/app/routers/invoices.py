"""Invoice evidence ingest (Class 2 §26): structured invoice records → scoped transaction-existence facts."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..canonicalization import promote_canonical_facts
from ..deps import get_session, require_engagement_owner
from ..invoice_evidence import ingest_invoice
from ..models import Engagement
from ..schemas import InvoiceIngest

router = APIRouter(tags=["invoices"])


@router.post("/engagements/{engagement_id}/invoices")
async def ingest_invoices(
    engagement_id: uuid.UUID,
    body: InvoiceIngest,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> dict:
    total = 0
    for inv in body.invoices:
        total += await ingest_invoice(
            session, engagement_id, document_id=inv.document_id, issuer=inv.issuer, recipient=inv.recipient,
            amount=inv.amount, currency=inv.currency, date=inv.date, number=inv.number,
            description=inv.description, agreement_ref=inv.agreement_ref)
    await session.flush()
    await promote_canonical_facts(session, engagement_id)
    await session.commit()
    return {"facts_created": total}
