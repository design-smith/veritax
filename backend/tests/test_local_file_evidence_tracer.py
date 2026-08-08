from __future__ import annotations

import uuid

from sqlalchemy import select

from app.canonicalization import promote_canonical_facts
from app.jobs import run_queued_pipeline_jobs_from_app
from app.main import app
from app.models import (
    CanonicalFact,
    CanonicalFactSource,
    Document,
    DocumentClassification,
    EntityMention,
    ExtractedFact,
    ExtractionRun,
)


async def _drain_pipeline() -> None:
    for _ in range(10):
        if await run_queued_pipeline_jobs_from_app(app, max_jobs=20) == 0:
            return
    raise AssertionError("pipeline did not settle")


async def test_local_file_evidence_tracer_from_upload_to_active_fact_reads(client):
    engagement_id = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{engagement_id}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    agreement = (
        await client.post(
            f"/engagements/{engagement_id}/documents",
            data={"kind": "agreements"},
            files={
                "files": (
                    "executed-service-agreement-fy2025.txt",
                    (
                        b"Executed service agreement for GlobalTech Netherlands BV. "
                        b"Territory Netherlands. Fiscal year FY2025. "
                        b"Service provider GlobalTech Swiss AG charges cost plus five percent."
                    ),
                    "text/plain",
                )
            },
        )
    ).json()[0]
    invoice = (
        await client.post(
            f"/engagements/{engagement_id}/documents",
            data={"kind": "financials"},
            files={
                "files": (
                    "invoice-population-fy2025.csv",
                    (
                        b"Invoice Number,Invoice Date,Amount,Entity,Counterparty,Fiscal Year,Jurisdiction\n"
                        b"INV-001,2025-01-15,900,GlobalTech Netherlands BV,GlobalTech Swiss AG,FY2025,Netherlands\n"
                        b"INV-002,2025-02-15,900,GlobalTech Netherlands BV,GlobalTech Swiss AG,FY2025,Netherlands\n"
                    ),
                    "text/csv",
                )
            },
        )
    ).json()[0]
    partial = (
        await client.post(
            f"/engagements/{engagement_id}/documents",
            data={"kind": "financials"},
            files={
                "files": (
                    "partial-general-ledger-fy2025.csv",
                    (
                        b"General Ledger,Account Code,Account Name,Entity,Fiscal Year,Jurisdiction\n"
                        b"GL,4000,Revenue,GlobalTech Netherlands BV,FY2025,Netherlands\n"
                    ),
                    "text/csv",
                )
            },
        )
    ).json()[0]

    assert (await client.post(f"/engagements/{engagement_id}/coverage", params={"jurisdiction": "Netherlands"})).status_code == 201
    await _drain_pipeline()

    coverage = (await client.get(f"/engagements/{engagement_id}/coverage", params={"jurisdiction": "Netherlands"})).json()
    assert coverage["requirements"]
    assert {row["status"] for row in coverage["requirements"]} <= {"present", "partial", "missing", "conditional"}

    async with app.state.session_factory() as session:
        classifications = (await session.execute(select(DocumentClassification))).scalars().all()
        runs = (await session.execute(select(ExtractionRun))).scalars().all()
        facts = (await session.execute(select(ExtractedFact))).scalars().all()
        mentions = (await session.execute(select(EntityMention))).scalars().all()

        assert {row.document_id for row in classifications} == {
            uuid.UUID(agreement["id"]),
            uuid.UUID(invoice["id"]),
            uuid.UUID(partial["id"]),
        }
        run_status_by_doc = {run.document_id: run.status for run in runs}
        assert run_status_by_doc[uuid.UUID(invoice["id"])] == "extracted"
        assert run_status_by_doc[uuid.UUID(partial["id"])] == "partially_extracted"
        assert any(run.status == "needs_review" for run in runs if run.document_id == uuid.UUID(agreement["id"]))
        assert facts
        assert mentions
        assert all(mention.resolution_status == "unresolved" for mention in mentions)

        result = await promote_canonical_facts(session, uuid.UUID(engagement_id))
        await session.commit()

    async with app.state.session_factory() as session:
        canonical = (await session.execute(select(CanonicalFact))).scalars().all()
        links = (await session.execute(select(CanonicalFactSource))).scalars().all()
        invoice_amount = next(row for row in canonical if row.fact_type == "invoice_amount" and row.value_normalized == "900")
        entity_canonical = [row for row in canonical if row.fact_type in {"entity_name", "counterparty_name"}]

    assert result.promoted >= 1
    assert len([link for link in links if link.canonical_fact_id == invoice_amount.id]) == 2
    assert entity_canonical == []

    visible_facts = (await client.get(f"/documents/{invoice['id']}/facts")).json()["facts"]
    invoice_amount_reads = [row for row in visible_facts if row["fact_type"] == "invoice_amount"]
    entity_reads = [row for row in visible_facts if row["fact_type"] in {"entity_name", "counterparty_name"}]
    assert len(invoice_amount_reads) == 2
    assert all(row["canonical_fact_id"] == str(invoice_amount.id) for row in invoice_amount_reads)
    assert entity_reads and all(row["entity_mention"]["resolution_status"] == "unresolved" for row in entity_reads)
    assert all(row["sources"][0]["quote"] for row in visible_facts)

    assert (await client.delete(f"/documents/{invoice['id']}")).status_code == 204
    assert (await client.get(f"/documents/{invoice['id']}/facts")).status_code == 404

    async with app.state.session_factory() as session:
        tombstoned_doc = await session.get(Document, uuid.UUID(invoice["id"]))
        preserved = (
            await session.execute(select(ExtractedFact).where(ExtractedFact.document_id == uuid.UUID(invoice["id"])))
        ).scalars().all()

    assert tombstoned_doc.is_active is False
    assert preserved
