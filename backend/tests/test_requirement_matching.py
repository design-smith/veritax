"""Requirement-matching HTTP slice: evaluate + list + detail/evidence/missing, backed by the deterministic
engine and a fake classified-documents provider (classification isn't built yet).

Material intercompany agreements (Netherlands:7): Executed Agreement AND (Invoice OR Ledger).
"""

from __future__ import annotations

import uuid

from app.canonicalization import promote_canonical_facts
from app.classification_store import ClassificationInput, store_classification
from app.extraction_store import ExtractedFactInput, FactSourceInput, RunInput, add_extracted_fact, create_extraction_run
from app.main import app
from app.matching import ClassifiedDoc, FakeClassifiedDocumentsProvider
from app.models import Document, ExtractionRun
from sqlalchemy import select

KEY = "Netherlands:7"


def _doc(document_type: str, **kw) -> ClassifiedDoc:
    base = dict(
        document_id=None,
        document_type=document_type,
        jurisdiction="Netherlands",
        entity="NL BV",
        fiscal_year="FY2025",
        executed=True,
    )
    base.update(kw)
    return ClassifiedDoc(**base)


async def _engagement(client) -> str:
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(f"/engagements/{eid}", json={"entity_name": "NL BV", "jurisdictions": ["Netherlands"]})
    return eid


def _classify(docs):
    app.state.classified_docs_provider = FakeClassifiedDocumentsProvider({"Netherlands": docs})


async def _evaluate(client, eid):
    return await client.post(f"/engagements/{eid}/requirements/evaluate", params={"jurisdiction": "Netherlands"})


async def _canonical_invoice_fact(client, eid: str) -> str:
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files={
                "files": (
                    "invoice-population.csv",
                    b"Invoice Number,Invoice Date,Amount,Entity,Customer\nINV-1,2025-01-01,900,NL BV,DE GmbH\n",
                    "text/csv",
                )
            },
        )
    ).json()[0]
    doc_id = uuid.UUID(uploaded["id"])
    async with app.state.session_factory() as session:
        run = await create_extraction_run(
            session,
            RunInput(
                engagement_id=uuid.UUID(eid),
                document_id=doc_id,
                schema_key="financial_table",
                schema_version="2026-08-07",
                classification_type="Invoice Population",
                classification_version="rules-v1",
                runner_version="test",
                model_version="test",
                fingerprint=f"invoice-{doc_id}",
                status="extracted",
            ),
        )
        await add_extracted_fact(
            session,
            run.id,
            doc_id,
            ExtractedFactInput(
                schema_key="financial_table",
                schema_version="2026-08-07",
                fact_type="invoice_amount",
                value_raw="900",
                value_normalized="900",
                value_type="money",
                period="FY2025",
                scope_level="transaction",
            ),
            sources=[FactSourceInput(document_id=doc_id, locator="row 2", quote="INV-1,2025-01-01,900")],
        )
        await promote_canonical_facts(session, uuid.UUID(eid))
        await session.commit()
    return uploaded["id"]


async def test_present_when_agreement_and_activity_classified(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement"), _doc("invoice")])

    r = await _evaluate(client, eid)
    assert r.status_code == 201
    results = {x["requirement_key"]: x for x in r.json()["results"]}
    assert results[KEY]["status"] == "present"
    assert results[KEY]["missing"] == []


async def test_partial_when_only_agreement_and_missing_names_the_gap(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement")])

    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY]["status"] == "partial"

    # /missing names exactly what's needed to finish it (as acceptable-doc groups).
    missing = (await client.get(f"/engagements/{eid}/requirements/{KEY}/missing",
                                params={"jurisdiction": "Netherlands"})).json()
    assert [g["acceptable"] for g in missing["missing"]] == [["invoice", "ledger"]]


async def test_active_canonical_facts_strengthen_requirements_without_replacing_source_provenance(client):
    eid = await _engagement(client)
    invoice_doc_id = await _canonical_invoice_fact(client, eid)
    _classify([_doc("executed_agreement")])

    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY]["status"] == "present"

    ev = (
        await client.get(
            f"/engagements/{eid}/requirements/{KEY}/evidence",
            params={"jurisdiction": "Netherlands"},
        )
    ).json()
    by_type = {e["document_type"]: e for e in ev}
    assert by_type["invoice"]["document_id"] == invoice_doc_id


async def test_canonical_facts_from_tombstoned_documents_are_excluded(client):
    eid = await _engagement(client)
    invoice_doc_id = await _canonical_invoice_fact(client, eid)
    async with app.state.session_factory() as session:
        doc = await session.get(Document, uuid.UUID(invoice_doc_id))
        doc.is_active = False
        await session.commit()
    _classify([_doc("executed_agreement")])

    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY]["status"] == "partial"


async def test_canonical_facts_from_out_of_scope_documents_are_excluded(client):
    eid = await _engagement(client)
    invoice_doc_id = await _canonical_invoice_fact(client, eid)
    async with app.state.session_factory() as session:
        await store_classification(
            session,
            uuid.UUID(invoice_doc_id),
            ClassificationInput(
                document_type="Invoice Population",
                classification_score=95,
                classification_state="rejected",
                relevance="out_of_scope",
                entity="NL BV",
                jurisdiction="Netherlands",
                fiscal_year="FY2024",
                scope_fingerprint=f"test-{invoice_doc_id}",
                classifier_version="test",
            ),
        )
        await session.commit()
    _classify([_doc("executed_agreement")])

    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY]["status"] == "partial"


async def test_canonical_facts_from_inactive_extraction_runs_are_excluded(client):
    eid = await _engagement(client)
    invoice_doc_id = await _canonical_invoice_fact(client, eid)
    async with app.state.session_factory() as session:
        run = (
            await session.execute(
                select(ExtractionRun).where(ExtractionRun.document_id == uuid.UUID(invoice_doc_id))
            )
        ).scalar_one()
        run.active = False
        await session.commit()
    _classify([_doc("executed_agreement")])

    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY]["status"] == "partial"


async def test_invalid_when_agreement_is_unexecuted(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement", executed=False), _doc("invoice")])

    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY]["status"] == "invalid"
    assert "not executed" in results[KEY]["explanation"]


async def test_evidence_endpoint_returns_matched_documents_with_roles(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement"), _doc("invoice")])
    await _evaluate(client, eid)

    ev = (await client.get(f"/engagements/{eid}/requirements/{KEY}/evidence",
                           params={"jurisdiction": "Netherlands"})).json()
    by_type = {e["document_type"]: e["role"] for e in ev}
    assert by_type == {"executed_agreement": "primary", "invoice": "supporting"}


async def test_detail_endpoint_bundles_status_evidence_and_missing(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement")])
    await _evaluate(client, eid)

    detail = (await client.get(f"/engagements/{eid}/requirements/{KEY}",
                               params={"jurisdiction": "Netherlands"})).json()
    assert detail["status"] == "partial"
    assert [e["document_type"] for e in detail["evidence"]] == ["executed_agreement"]
    assert ["invoice", "ledger"] in detail["missing"]


async def test_missing_everywhere_without_evidence(client):
    eid = await _engagement(client)
    _classify([])  # nothing classified

    results = {x["requirement_key"]: x["status"] for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY] == "missing"


async def test_list_includes_requirement_severity(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement"), _doc("invoice")])
    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY]["severity"] == "critical"


async def test_missing_endpoint_suggests_sources(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement")])  # partial → needs invoice/ledger (financial docs)
    await _evaluate(client, eid)

    missing = (await client.get(f"/engagements/{eid}/requirements/{KEY}/missing",
                                params={"jurisdiction": "Netherlands"})).json()
    assert missing["severity"] == "critical"
    group = next(g for g in missing["missing"] if g["acceptable"] == ["invoice", "ledger"])
    assert "SAP" in group["sources"] and "NetSuite" in group["sources"]


async def test_override_marks_requirement_present_with_audit(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement")])  # partial: missing activity
    await _evaluate(client, eid)

    r = await client.post(
        f"/engagements/{eid}/requirements/{KEY}/override",
        params={"jurisdiction": "Netherlands"},
        json={"justification": "Working paper on file."},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "present"
    assert body["overridden"] is True
    assert "Working paper" in body["explanation"]


async def test_override_persists_across_reevaluation(client):
    eid = await _engagement(client)
    _classify([_doc("executed_agreement")])
    await _evaluate(client, eid)
    await client.post(
        f"/engagements/{eid}/requirements/{KEY}/override",
        params={"jurisdiction": "Netherlands"}, json={"justification": "asserted"},
    )
    # Re-running the deterministic matcher must not wipe the human override.
    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results[KEY]["status"] == "present"
    assert results[KEY]["overridden"] is True


async def test_override_requires_an_evaluated_requirement(client):
    eid = await _engagement(client)  # never evaluated
    r = await client.post(
        f"/engagements/{eid}/requirements/{KEY}/override",
        params={"jurisdiction": "Netherlands"}, json={"justification": "x"},
    )
    assert r.status_code == 404


async def test_arms_length_is_blocked_until_method_selection_is_present(client):
    # Netherlands:15 (Arm's-length) depends on Netherlands:9 (Method selection). No benchmark → 9 missing.
    eid = await _engagement(client)
    _classify([])

    results = {x["requirement_key"]: x for x in (await _evaluate(client, eid)).json()["results"]}
    assert results["Netherlands:9"]["status"] == "missing"
    assert results["Netherlands:15"]["status"] == "blocked"
    assert "Method selection" in results["Netherlands:15"]["explanation"]

    # A benchmark study satisfies Method selection → Arm's-length unblocks and is itself satisfied.
    _classify([_doc("benchmark_study")])
    results = {x["requirement_key"]: x["status"] for x in (await _evaluate(client, eid)).json()["results"]}
    assert results["Netherlands:9"] == "present"
    assert results["Netherlands:15"] == "present"
