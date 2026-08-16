import io
import uuid
import zipfile

from app.drafting import SYSTEM_PROMPT, FakeDrafter
from app.main import app
from app.models import CanonicalFact, Document, DocumentChunk
from app.requirements import draft_elements, resolve_requirements


def _ready_text(jurisdiction: str, text: bytes) -> bytes:
    required = " ".join(f"{e.element_name} {e.description}" for e in resolve_requirements(jurisdiction))
    return text + b" " + required.encode()


async def _engagement_ready_for_draft(client, jurisdiction: str, text: bytes) -> str:
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("notes.txt", _ready_text(jurisdiction, text), "text/plain")},
    )
    coverage = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": jurisdiction})
    assert coverage.status_code == 201
    got = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": jurisdiction})).json()
    assert got["summary"]["draft_ready"] is True
    return eid


async def test_start_draft_creates_sections_and_drafts(client):
    eid = await _engagement_ready_for_draft(client, "Netherlands", b"The entity is a limited-risk distributor. Royalty is five percent.")

    started = await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201
    # One section per draft element (statutory requirements + the injected Industry Analysis section).
    assert len(started.json()["sections"]) == len(draft_elements("Netherlands"))

    got = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()
    assert got["summary"]["pending"] == 0
    sec = got["sections"][0]
    assert sec["status"] == "drafted"
    assert sec["content"] and sec["element_name"] in sec["content"]
    # Provenance captured — citation resolves to the uploaded document.
    assert sec["citations"]
    assert sec["citations"][0]["kind"] == "document"
    assert sec["citations"][0]["document_id"]


async def test_start_draft_idempotent(client):
    import asyncio

    eid = await _engagement_ready_for_draft(client, "Canada", b"placeholder")
    r1, r2 = await asyncio.gather(
        client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Canada"}),
        client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Canada"}),
    )
    assert r1.status_code == 201 and r2.status_code == 201
    sections = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Canada"})).json()["sections"]
    assert len(sections) == len(draft_elements("Canada"))  # not doubled


async def test_draft_stops_after_section_failure(client):
    class FirstSectionFailingDrafter(FakeDrafter):
        def __init__(self) -> None:
            self.calls = 0

        def draft(self, element, register, documents, coverage_note, scope_note=""):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("provider failed")
            return super().draft(element, register, documents, coverage_note, scope_note)

    app.state.drafter = FirstSectionFailingDrafter()
    eid = await _engagement_ready_for_draft(client, "Canada", b"placeholder")

    started = await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Canada"})

    assert started.status_code == 201
    got = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Canada"})).json()
    assert app.state.drafter.calls == 1
    assert got["summary"]["pending"] == 0
    assert got["summary"]["failed"] == len(draft_elements("Canada"))
    assert got["sections"][0]["error"] == "provider failed"
    assert all(section["status"] == "failed" for section in got["sections"])
    assert all("Draft stopped" in section["error"] for section in got["sections"][1:])


async def test_regenerate_section(client):
    eid = await _engagement_ready_for_draft(client, "Netherlands", b"management structure and reporting lines")
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    sections = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()["sections"]
    sid = sections[0]["id"]

    r = await client.post(f"/draft-sections/{sid}/regenerate")
    assert r.status_code == 200
    assert r.json()["status"] == "drafted"
    assert r.json()["content"]


async def test_update_draft_section_persists_to_docx(client):
    eid = await _engagement_ready_for_draft(client, "Netherlands", b"The entity is a limited-risk distributor.")
    await client.patch(f"/engagements/{eid}", json={"entity_name": "Acme B.V.", "jurisdictions": ["Netherlands"]})
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    sections = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()["sections"]
    sid = sections[0]["id"]
    edited = "Reviewer edited wording with source marker [1]."

    r = await client.patch(f"/draft-sections/{sid}", json={"content": edited})

    assert r.status_code == 200
    assert r.json()["content"] == edited
    z = zipfile.ZipFile(io.BytesIO((await client.get(
        f"/engagements/{eid}/draft.docx", params={"jurisdiction": "Netherlands"}
    )).content))
    doc = z.read("word/document.xml").decode("utf-8")
    assert "Reviewer edited wording" in doc


async def test_draft_docx_download_uses_clean_local_file_cover(client):
    eid = await _engagement_ready_for_draft(client, "Netherlands", b"The entity is a limited-risk distributor.")
    await client.patch(f"/engagements/{eid}", json={"entity_name": "Acme B.V.", "jurisdictions": ["Netherlands"]})
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})

    r = await client.get(f"/engagements/{eid}/draft.docx", params={"jurisdiction": "Netherlands"})

    assert r.status_code == 200
    assert "Acme-B-V-Netherlands-Local-File.docx" in r.headers["content-disposition"]
    z = zipfile.ZipFile(io.BytesIO(r.content))
    doc = z.read("word/document.xml").decode("utf-8")
    assert "Transfer Pricing Local File" in doc
    assert "Draft prepared for review" in doc
    assert "Prepared by Veritax" in doc
    assert "Planning File" not in doc


async def test_draft_retrieval_excludes_out_of_scope_documents(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={"entity_name": "Acme BV", "jurisdictions": ["Netherlands"], "fiscal_year": "FY2025"},
    )
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("notes.txt", _ready_text("Netherlands", b"Acme BV Netherlands FY2025"), "text/plain")},
    )
    skipped = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={
                "files": (
                    "wrong-year.txt",
                    b"Service agreement for Acme BV. Territory Netherlands. FY2024.",
                    "text/plain",
                )
            },
        )
    ).json()[0]
    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.json()["skipped_documents"][0]["filename"] == "wrong-year.txt"
    coverage = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).json()
    assert coverage["summary"]["draft_ready"] is True
    assert coverage["skipped_documents"][0]["filename"] == "wrong-year.txt"
    async with app.state.session_factory() as session:
        doc = await session.get(Document, uuid.UUID(skipped["id"]))
        doc.status = "embedded"
        session.add(
            DocumentChunk(
                document_id=uuid.UUID(skipped["id"]),
                chunk_index=0,
                content="Wrong year service agreement FY2024.",
                embedding=app.state.embedder.embed_documents(["Wrong year service agreement FY2024."])[0],
            )
        )
        await session.commit()

    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    got = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()

    cited_labels = {citation["source_label"] for section in got["sections"] for citation in section["citations"]}
    assert "wrong-year.txt" not in cited_labels


async def test_industry_analysis_section_is_injected_non_gating_with_research(client):
    # Draft is ready from statutory coverage alone (Industry Analysis never gates it), and the section is drafted.
    eid = await _engagement_ready_for_draft(client, "Netherlands", b"The entity is a limited-risk distributor.")
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    got = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()
    assert got["summary"]["pending"] == 0 and got["summary"]["failed"] == 0

    industry = next(s for s in got["sections"] if s["element_name"] == "Industry Analysis")
    assert industry["status"] == "drafted"
    # Web-research card round-trips through the API and carries its sources.
    assert industry["research"] is not None and industry["research"]["market"] == "Netherlands"
    assert industry["research"]["sources"]
    # Provenance is web citations (URL), not document citations.
    assert industry["citations"] and industry["citations"][0]["kind"] == "web"
    assert industry["citations"][0]["url"] and industry["citations"][0]["document_id"] is None
    # Positioned right after Business Strategy.
    ordered = [s["element_name"] for s in sorted(got["sections"], key=lambda s: s["element_order"])]
    assert "strateg" in ordered[ordered.index("Industry Analysis") - 1].lower()

    # The .docx exports cleanly — the citation-less research section does not block the export.
    docx = await client.get(f"/engagements/{eid}/draft.docx", params={"jurisdiction": "Netherlands"})
    assert docx.status_code == 200
    doc_xml = zipfile.ZipFile(io.BytesIO(docx.content)).read("word/document.xml").decode("utf-8")
    assert "Industry Analysis" in doc_xml


async def test_local_regulations_section_is_deterministic_and_snapshots(client):
    # Qatar has registry rules → a deterministic Local Regulations section leads the draft, and a snapshot is pinned.
    from sqlalchemy import select

    from app.models import EngagementRegulatorySnapshot

    eid = await _engagement_ready_for_draft(client, "Qatar", b"The entity is a limited-risk distributor.")
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Qatar"})
    got = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Qatar"})).json()
    assert got["summary"]["pending"] == 0 and got["summary"]["failed"] == 0

    reg = next(s for s in got["sections"] if s["element_name"] == "Local Regulations")
    assert reg["status"] == "drafted" and reg["content"]
    # Deterministic content from the registry — restates the rules + cites their sources, no LLM.
    assert "Local File" in reg["content"] and "200,000" in reg["content"] and "Resolution" in reg["content"]
    # It leads the document.
    ordered = sorted(got["sections"], key=lambda s: s["element_order"])
    assert ordered[0]["element_name"] == "Local Regulations"

    # The shared regulatory snapshot is pinned for the engagement (Requirements/Draft/Risks read the same one).
    async with app.state.session_factory() as session:
        snap = (await session.execute(select(EngagementRegulatorySnapshot).where(
            EngagementRegulatorySnapshot.engagement_id == uuid.UUID(eid),
            EngagementRegulatorySnapshot.jurisdiction == "Qatar",
        ))).scalar_one()
    keys = {r["rule_key"] for r in snap.snapshot["rules"]}
    assert {"local_file_required", "master_file_required", "transaction_category_materiality"} <= keys


async def _seed_functional_fact(session, engagement_id, fact_type, far_type):
    session.add(CanonicalFact(
        engagement_id=engagement_id, fact_type=fact_type, value_normalized="true", value_type="boolean",
        scope_level="local_entity", far_type=far_type, transaction_id="txn_1",
        evidence_type="functional_interview", canonical_key=f"k-{fact_type}-{far_type}-{uuid.uuid4().hex[:8]}"))


async def test_functional_analysis_section_is_deterministic_from_far_evidence(client):
    # S12: the Functional Analysis section is built deterministically from the FAR profile + risk-control rows.
    eid = await _engagement_ready_for_draft(client, "Netherlands", b"The entity is a limited-risk distributor.")
    async with app.state.session_factory() as session:
        await _seed_functional_fact(session, uuid.UUID(eid), "function_performed", "distribution")
        await _seed_functional_fact(session, uuid.UUID(eid), "risk_assumed", "foreign_exchange_risk")
        await session.commit()
    await client.post(f"/engagements/{eid}/risk-control", json={"items": [
        {"transaction_id": "txn_1", "risk_type": "foreign_exchange_risk", "contractual_bearer_entity_id": "NL",
         "control_entity_id": "NL", "capability_entity_id": "NL"}]})

    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    got = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()
    assert got["summary"]["pending"] == 0 and got["summary"]["failed"] == 0

    fn = next(s for s in got["sections"] if s["element_name"] == "Functional Analysis")
    assert fn["status"] == "drafted" and fn["content"]
    # Deterministic content from the FAR profile — no LLM, no document citations.
    assert "distribution" in fn["content"]
    assert "foreign exchange risk" in fn["content"]              # risk-control table row
    assert "characterization" in fn["content"].lower()
    assert not fn["citations"]
    # Positioned right after Industry Analysis.
    ordered = [s["element_name"] for s in sorted(got["sections"], key=lambda s: s["element_order"])]
    assert ordered[ordered.index("Functional Analysis") - 1] == "Industry Analysis"


async def test_functional_analysis_section_is_non_gating_without_evidence(client):
    # No functional evidence → an honest 'not yet established' section that still drafts and never blocks.
    eid = await _engagement_ready_for_draft(client, "Netherlands", b"The entity is a limited-risk distributor.")
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    got = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()
    assert got["summary"]["failed"] == 0
    fn = next(s for s in got["sections"] if s["element_name"] == "Functional Analysis")
    assert fn["status"] == "drafted"
    assert "not yet established" in fn["content"].lower()


async def test_unknown_jurisdiction_404(client):
    eid = (await client.post("/engagements")).json()["id"]
    r = await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Narnia"})
    assert r.status_code == 404


def test_system_prompt_encodes_the_laws():
    p = SYSTEM_PROMPT.lower()
    assert "local file" in p
    assert "planning file" not in p
    assert "citation" in p                      # L1: cite every claim
    assert "never" in p and "number" in p       # L3: numbers never generated
    assert "web_search only" not in p            # local file drafting is confidential-source only
    assert "outside knowledge" in p or "gaps" in p
    assert "not judge" in p or "correct" in p   # sufficiency not correctness
