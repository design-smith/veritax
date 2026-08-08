import uuid

from sqlalchemy import select

from app.agreement_extraction import AgreementFact, AgreementExtraction, extract_agreement_document
from app.main import app
from app.models import Document, ExtractedFact, ExtractionExpectedField, FactSource


class FakeAgreementExtractor:
    model_version = "fake-agreement-model"

    def __init__(self, result: AgreementExtraction) -> None:
        self.result = result

    def extract(self, text: str, schema: dict) -> AgreementExtraction:
        return self.result


async def _agreement_doc(client, text: str) -> tuple[str, Document, bytes]:
    eid = (await client.post("/engagements")).json()["id"]
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("services.txt", text.encode(), "text/plain")},
        )
    ).json()[0]
    async with app.state.session_factory() as session:
        doc = await session.get(Document, uuid.UUID(uploaded["id"]))
        assert doc is not None
        data = app.state.storage.get(doc.storage_key)
        return eid, doc, data


async def test_agreement_runner_persists_schema_valid_quote_backed_facts(client):
    text = (
        "Agreement Type: Service Agreement. Provider: Starbucks Corporation. "
        "Recipient: Starbucks Coffee Trading Company. Services: treasury and procurement support. "
        "Effective Date: 1 January 2025. Pricing: cost plus five percent markup."
    )
    eid, doc, data = await _agreement_doc(client, text)
    extractor = FakeAgreementExtractor(
        AgreementExtraction(
            facts=[
                AgreementFact("agreement_type", "Service Agreement", "Service Agreement"),
                AgreementFact("provider", "Starbucks Corporation", "Provider: Starbucks Corporation"),
                AgreementFact("recipient", "Starbucks Coffee Trading Company", "Recipient: Starbucks Coffee Trading Company"),
                AgreementFact("services_description", "treasury and procurement support", "treasury and procurement support"),
                AgreementFact("effective_date", "1 January 2025", "Effective Date: 1 January 2025"),
                AgreementFact(
                    "pricing_method",
                    "cost plus",
                    "Pricing: cost plus five percent markup",
                ),
                AgreementFact(
                    "markup",
                    "five percent",
                    "five percent markup",
                    value_normalized="0.05",
                    unit="%",
                ),
            ]
        )
    )

    async with app.state.session_factory() as session:
        run = await extract_agreement_document(
            session,
            document=doc,
            data=data,
            extractor=extractor,
            classification_type="Service Agreement",
            classification_version="rules-v1",
        )
        await session.commit()

    async with app.state.session_factory() as session:
        facts = (await session.execute(select(ExtractedFact).order_by(ExtractedFact.fact_type))).scalars().all()
        sources = (await session.execute(select(FactSource))).scalars().all()
        reloaded_doc = await session.get(Document, doc.id)

    assert run.engagement_id == uuid.UUID(eid)
    assert run.status == "extracted"
    assert reloaded_doc.extraction_status == "extracted"
    assert {fact.fact_type for fact in facts} == {
        "agreement_type",
        "provider",
        "recipient",
        "services_description",
        "effective_date",
        "pricing_method",
        "markup",
    }
    assert next(fact for fact in facts if fact.fact_type == "markup").value_normalized == "0.05"
    assert all(source.locator == "line 1" and source.quote for source in sources)


async def test_agreement_runner_rejects_unsupported_facts_and_records_missing_fields(client):
    text = "Provider: Starbucks Corporation. Pricing: cost plus five percent markup."
    _, doc, data = await _agreement_doc(client, text)
    extractor = FakeAgreementExtractor(
        AgreementExtraction(
            facts=[
                AgreementFact("provider", "Starbucks Corporation", "Provider: Starbucks Corporation"),
                AgreementFact("tax_opinion", "arm's length", "cost plus five percent markup"),
            ]
        )
    )

    async with app.state.session_factory() as session:
        run = await extract_agreement_document(
            session,
            document=doc,
            data=data,
            extractor=extractor,
            classification_type="Service Agreement",
            classification_version="rules-v1",
        )
        await session.commit()

    async with app.state.session_factory() as session:
        facts = (await session.execute(select(ExtractedFact))).scalars().all()
        expected = (await session.execute(select(ExtractionExpectedField))).scalars().all()

    assert run.status == "partially_extracted"
    assert run.diagnostics["invalid_facts"][0]["fact_type"] == "tax_opinion"
    assert {fact.fact_type for fact in facts} == {"provider"}
    assert "recipient" in {row.field_name for row in expected if row.status == "missing"}
    assert "pricing_method" in {row.field_name for row in expected if row.status == "missing"}
