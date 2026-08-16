"""S8: invoice evidence — scoped transaction-existence facts that CANNOT establish FAR (§26)."""
import uuid

from sqlalchemy import select

from app.functional import FUNCTIONAL_FACT_TYPES
from app.main import app
from app.models import CanonicalFact, ExtractedFact


async def _engagement_with_doc(client) -> tuple[str, str]:
    eid = (await client.post("/engagements")).json()["id"]
    doc = (await client.post(f"/engagements/{eid}/documents", data={"kind": "financials"},
                             files={"files": ("invoice.txt", b"Invoice INV-1", "text/plain")})).json()[0]
    return eid, doc["id"]


async def test_invoice_creates_scoped_transaction_facts_not_far(client):
    eid, doc_id = await _engagement_with_doc(client)
    r = await client.post(f"/engagements/{eid}/invoices", json={"invoices": [
        {"document_id": doc_id, "issuer": "CH Principal", "recipient": "QA Entity",
         "amount": 500000, "currency": "USD", "number": "INV-1", "date": "2026-03-31",
         "description": "Management services"}]})
    assert r.status_code == 200 and r.json()["facts_created"] >= 3

    async with app.state.session_factory() as session:
        efs = (await session.execute(
            select(ExtractedFact).where(ExtractedFact.engagement_id == uuid.UUID(eid)))).scalars().all()
        cfs = (await session.execute(select(CanonicalFact))).scalars().all()
    # Transaction-existence facts, document-sourced, properly scoped.
    kinds = {e.fact_type for e in efs}
    assert {"invoice_issuer", "invoice_recipient", "invoice_amount"} <= kinds
    assert all(e.document_id is not None for e in efs)
    assert {e.scope_level for e in efs} <= {"counterparty", "transaction"}
    # §26: invoices carry NO far_type and are NOT functional facts — they cannot establish FAR.
    assert all(e.far_type is None for e in efs)
    assert not (kinds & FUNCTIONAL_FACT_TYPES)
    assert cfs   # they still canonicalize as ordinary (non-functional) facts
