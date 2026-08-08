import uuid

from sqlalchemy import select

from app.corpus import retrieve_documents, usable_source_filter
from app.classification_store import (
    ClassificationInput,
    load_classification,
    scope_fingerprint,
    store_classification,
)
from app.main import app
from app.models import (
    CoverageSupplement,
    Document,
    DocumentChunk,
    DocumentClassification,
    DocumentScope,
    DocumentTag,
    ExtractedFact,
    ExtractionRun,
    PipelineJob,
    PipelineJobKind,
    Source,
    SourceKind,
)


def _pdf_bytes(text: str) -> bytes:
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    objects = [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        (
            "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
        ),
        "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    ]
    stream = f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET"
    objects.append(f"5 0 obj << /Length {len(stream)} >> stream\n{stream}\nendstream endobj\n")
    content = "%PDF-1.4\n"
    offsets = [0]
    for obj in objects:
        offsets.append(len(content.encode()))
        content += obj
    xref_at = len(content.encode())
    content += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    content += "".join(f"{offset:010d} 00000 n \n" for offset in offsets[1:])
    content += f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n"
    return content.encode()


def _xlsx_bytes(rows: list[list[str]], *, sheet_name: str = "Sheet1") -> bytes:
    from io import BytesIO

    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    for row in rows:
        ws.append(row)
    out = BytesIO()
    wb.save(out)
    return out.getvalue()


def _docx_bytes(paragraphs: list[str]) -> bytes:
    from io import BytesIO

    from docx import Document as Docx

    doc = Docx()
    for paragraph in paragraphs:
        doc.add_paragraph(paragraph)
    out = BytesIO()
    doc.save(out)
    return out.getvalue()


async def _document_id(client) -> str:
    eid = (await client.post("/engagements")).json()["id"]
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("services.txt", b"Intercompany services agreement FY2025", "text/plain")},
        )
    ).json()[0]
    return doc["id"]


def test_scope_fingerprint_changes_with_scope():
    base = scope_fingerprint(
        document_hash="abc",
        entity_name="Acme BV",
        jurisdictions=["Netherlands", "Germany"],
        fiscal_year="FY2025",
        classifier_version="v1",
    )
    same = scope_fingerprint(
        document_hash="abc",
        entity_name="Acme BV",
        jurisdictions=["Germany", "Netherlands"],
        fiscal_year="FY2025",
        classifier_version="v1",
    )
    changed = scope_fingerprint(
        document_hash="abc",
        entity_name="Acme BV",
        jurisdictions=["Netherlands", "Germany"],
        fiscal_year="FY2024",
        classifier_version="v1",
    )

    assert base == same
    assert base != changed


async def test_store_and_update_document_classification(client):
    document_id = await _document_id(client)

    async with app_session() as session:
        first = ClassificationInput(
            document_type="Service Agreement",
            classification_score=82,
            classification_state="accepted",
            relevance="relevant",
            tags=["Intercompany", "Services"],
            entity="Acme BV",
            jurisdiction="Netherlands",
            fiscal_year="FY2025",
            language="English",
            document_status="Executed",
            version="Final",
            source_validation_result={"entity": "pass"},
            deterministic_signals=["service agreement"],
            llm_supporting_quotes=[],
            candidate_requirements=["Material Agreements"],
            candidate_extractors=["Agreement Extractor"],
            scope_fingerprint="fp1",
            classifier_version="rules-v1",
            diagnostics={},
        )
        await store_classification(session, uuid.UUID(document_id), first)
        await session.commit()

        loaded = await load_classification(session, uuid.UUID(document_id))
        assert loaded is not None
        assert loaded.document_type == "Service Agreement"
        assert loaded.tags == ["Intercompany", "Services"]
        assert loaded.scope.entity == "Acme BV"

        second = first.model_copy(update={"document_type": "Unknown", "classification_score": 0, "tags": []})
        await store_classification(session, uuid.UUID(document_id), second)
        await session.commit()

        rows = (await session.execute(select(DocumentClassification))).scalars().all()
        tags = (await session.execute(select(DocumentTag))).scalars().all()
        scopes = (await session.execute(select(DocumentScope))).scalars().all()

        loaded = await load_classification(session, uuid.UUID(document_id))
        assert len(rows) == 1
        assert tags == []
        assert len(scopes) == 1
        assert loaded is not None
        assert loaded.document_type == "Unknown"


async def test_deleting_document_deletes_classification_records(client):
    document_id = await _document_id(client)

    async with app_session() as session:
        await store_classification(
            session,
            uuid.UUID(document_id),
            ClassificationInput(
                document_type="Service Agreement",
                classification_score=82,
                classification_state="accepted",
                relevance="relevant",
                tags=["Intercompany"],
                scope_fingerprint="fp1",
                classifier_version="rules-v1",
            ),
        )
        doc = await session.get(Document, uuid.UUID(document_id))
        await session.delete(doc)
        await session.commit()

        assert (await session.execute(select(DocumentClassification))).scalars().all() == []
        assert (await session.execute(select(DocumentTag))).scalars().all() == []
        assert (await session.execute(select(DocumentScope))).scalars().all() == []


async def test_requirements_start_classifies_uploaded_agreement(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={
                "files": (
                    "services-agreement-fy2025.txt",
                    b"Intercompany services agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2025.",
                    "text/plain",
                )
            },
        )
    ).json()[0]

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201

    async with app_session() as session:
        loaded = await load_classification(session, uuid.UUID(doc["id"]))
    assert loaded is not None
    assert loaded.document_type == "Service Agreement"
    assert loaded.relevance == "relevant"
    assert loaded.scope.entity == "GlobalTech Netherlands BV"
    assert loaded.scope.jurisdiction == "Netherlands"
    assert loaded.scope.fiscal_year == "FY2025"
    assert "Agreement Extractor" in loaded.candidate_extractors


async def test_requirements_start_classifies_uploaded_csv_trial_balance(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files={
                "files": (
                    "trial-balance-fy2025.csv",
                    b"Account Code,Account Name,Debit,Credit,Fiscal Year,Entity\n4000,Revenue,0,1200,FY2025,GlobalTech Netherlands BV\n",
                    "text/csv",
                )
            },
        )
    ).json()[0]

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201

    async with app_session() as session:
        loaded = await load_classification(session, uuid.UUID(doc["id"]))
    assert loaded is not None
    assert loaded.document_type == "Trial Balance"
    assert loaded.relevance == "partially_relevant"
    assert loaded.scope.fiscal_year == "FY2025"


async def test_requirements_start_queues_extraction_jobs_for_eligible_supported_documents_only(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    service_doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={
                "files": (
                    "services-agreement-fy2025.txt",
                    b"Intercompany service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2025.",
                    "text/plain",
                )
            },
        )
    ).json()[0]
    trial_balance_doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files={
                "files": (
                    "trial-balance-fy2025.csv",
                    b"Trial Balance\nAccount Code,Account Name,Debit,Credit,Fiscal Year,Entity\n4000,Revenue,0,1200,FY2025,GlobalTech Netherlands BV\n",
                    "text/csv",
                )
            },
        )
    ).json()[0]
    unsupported_doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "public"},
            files={
                "files": (
                    "strategy-presentation.txt",
                    b"Presentation for GlobalTech Netherlands BV in Netherlands FY2025.",
                    "text/plain",
                )
            },
        )
    ).json()[0]
    out_of_scope_doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={
                "files": (
                    "services-agreement-fy2024.txt",
                    b"Intercompany service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2024.",
                    "text/plain",
                )
            },
        )
    ).json()[0]

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201

    async with app_session() as session:
        jobs = (
            await session.execute(select(PipelineJob).where(PipelineJob.kind == PipelineJobKind.extract_document))
        ).scalars().all()
        runs = (await session.execute(select(ExtractionRun))).scalars().all()
        docs = {
            str(row.id): row
            for row in (
                await session.execute(select(Document).where(Document.id.in_([
                    uuid.UUID(service_doc["id"]),
                    uuid.UUID(trial_balance_doc["id"]),
                    uuid.UUID(unsupported_doc["id"]),
                    uuid.UUID(out_of_scope_doc["id"]),
                ])))
            ).scalars().all()
        }

    job_doc_ids = {str(job.payload["document_id"]) for job in jobs}
    assert {service_doc["id"], trial_balance_doc["id"]} <= job_doc_ids
    assert unsupported_doc["id"] not in job_doc_ids
    assert out_of_scope_doc["id"] not in job_doc_ids
    assert {str(run.document_id) for run in runs} <= {service_doc["id"], trial_balance_doc["id"]}
    assert docs[service_doc["id"]].extraction_status == "needs_review"
    assert docs[trial_balance_doc["id"]].extraction_status in {"extracted", "partially_extracted"}
    assert docs[unsupported_doc["id"]].extraction_status == "skipped_not_supported"
    assert docs[out_of_scope_doc["id"]].extraction_status == "skipped_out_of_scope"


async def test_requirements_start_does_not_classify_interview_sources(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "interview"},
            files={
                "files": (
                    "tax-interview-notes.txt",
                    b"Interview notes for GlobalTech Netherlands BV, Netherlands, FY2025. Management described intercompany services.",
                    "text/plain",
                )
            },
        )
    ).json()[0]

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201

    async with app_session() as session:
        loaded = await load_classification(session, uuid.UUID(doc["id"]))
        interview_doc = await session.get(Document, uuid.UUID(doc["id"]))

    assert loaded is None
    assert interview_doc.status == "embedded"


async def test_requirements_reclassifies_when_fiscal_year_changes(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={
                "files": (
                    "services-agreement-fy2025.txt",
                    b"Intercompany services agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2025.",
                    "text/plain",
                )
            },
        )
    ).json()[0]

    assert (await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).status_code == 201
    async with app_session() as session:
        first = await load_classification(session, uuid.UUID(doc["id"]))

    await client.patch(f"/engagements/{eid}", json={"fiscal_year": "FY2024"})
    assert (
        await client.post(
            f"/engagements/{eid}/coverage",
            params={"jurisdiction": "Netherlands", "force": "true"},
        )
    ).status_code == 201

    async with app_session() as session:
        second = await load_classification(session, uuid.UUID(doc["id"]))

    assert first is not None
    assert second is not None
    assert second.scope_fingerprint != first.scope_fingerprint
    assert second.scope.fiscal_year == "FY2025"
    assert second.relevance == "out_of_scope"


async def test_requirements_start_classifies_pdf_preview_outcomes(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files=[
                (
                    "files",
                    (
                        "relevant-services.pdf",
                        _pdf_bytes(
                            "Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2025."
                        ),
                        "application/pdf",
                    ),
                ),
                (
                    "files",
                    (
                        "partial-services.pdf",
                        _pdf_bytes("Service agreement for GlobalTech Netherlands BV. FY2025."),
                        "application/pdf",
                    ),
                ),
                ("files", ("unknown.pdf", _pdf_bytes("Quarterly working notes."), "application/pdf")),
                (
                    "files",
                    (
                        "wrong-year-services.pdf",
                        _pdf_bytes(
                            "Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2024."
                        ),
                        "application/pdf",
                    ),
                ),
            ],
        )
    ).json()

    assert (await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).status_code == 201

    async with app_session() as session:
        loaded = {
            doc["original_filename"]: await load_classification(session, uuid.UUID(doc["id"]))
            for doc in uploaded
        }

    assert loaded["relevant-services.pdf"].document_type == "Service Agreement"
    assert loaded["relevant-services.pdf"].relevance == "relevant"
    assert loaded["partial-services.pdf"].document_type == "Service Agreement"
    assert loaded["partial-services.pdf"].relevance == "partially_relevant"
    assert loaded["unknown.pdf"].document_type == "Unknown"
    assert loaded["unknown.pdf"].relevance == "unknown"
    assert loaded["wrong-year-services.pdf"].document_type == "Service Agreement"
    assert loaded["wrong-year-services.pdf"].relevance == "out_of_scope"


async def test_requirements_start_classifies_docx_preview_without_scanning_entire_file(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    late_signal = ["General administrative notes."] * 80 + [
        "Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2025."
    ]
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files=[
                (
                    "files",
                    (
                        "services.docx",
                        _docx_bytes([
                            "Service agreement for GlobalTech Netherlands BV.",
                            "Territory Netherlands. FY2025.",
                        ]),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ),
                ),
                (
                    "files",
                    (
                        "late-only.docx",
                        _docx_bytes(late_signal),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ),
                ),
            ],
        )
    ).json()

    assert (await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).status_code == 201

    async with app_session() as session:
        loaded = {
            doc["original_filename"]: await load_classification(session, uuid.UUID(doc["id"]))
            for doc in uploaded
        }

    assert loaded["services.docx"].document_type == "Service Agreement"
    assert loaded["services.docx"].relevance == "relevant"
    assert loaded["late-only.docx"].document_type == "Unknown"


async def test_requirements_start_classifies_csv_preview_outcomes(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    large_rows = "\n".join(f"400{i},Revenue,0,{i},FY2025,GlobalTech Netherlands BV" for i in range(200))
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files=[
                (
                    "files",
                    (
                        "trial-balance-netherlands-fy2025.csv",
                        f"Account Code,Account Name,Debit,Credit,Fiscal Year,Entity\n{large_rows}\n".encode(),
                        "text/csv",
                    ),
                ),
                (
                    "files",
                    (
                        "general-ledger-fy2025.csv",
                        b"Posting Date,Journal,Account Code,Amount,Fiscal Year,Entity\n2025-01-01,J1,4000,100,FY2025,GlobalTech Netherlands BV\n",
                        "text/csv",
                    ),
                ),
                (
                    "files",
                    (
                        "unknown.csv",
                        b"Column A,Column B\nfoo,bar\n",
                        "text/csv",
                    ),
                ),
                (
                    "files",
                    (
                        "trial-balance-fy2024.csv",
                        b"Account Code,Account Name,Debit,Credit,Fiscal Year,Entity\n4000,Revenue,0,1200,FY2024,GlobalTech Netherlands BV\n",
                        "text/csv",
                    ),
                ),
            ],
        )
    ).json()

    assert (await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).status_code == 201

    async with app_session() as session:
        loaded = {
            doc["original_filename"]: await load_classification(session, uuid.UUID(doc["id"]))
            for doc in uploaded
        }

    assert loaded["trial-balance-netherlands-fy2025.csv"].document_type == "Trial Balance"
    assert loaded["trial-balance-netherlands-fy2025.csv"].relevance == "relevant"
    assert loaded["trial-balance-netherlands-fy2025.csv"].diagnostics["preview_chars"] <= 4000
    assert loaded["general-ledger-fy2025.csv"].document_type == "General Ledger"
    assert loaded["general-ledger-fy2025.csv"].relevance == "partially_relevant"
    assert loaded["unknown.csv"].document_type == "Unknown"
    assert loaded["unknown.csv"].relevance == "unknown"
    assert loaded["trial-balance-fy2024.csv"].document_type == "Trial Balance"
    assert loaded["trial-balance-fy2024.csv"].relevance == "out_of_scope"


async def test_requirements_start_classifies_excel_preview_outcomes(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    late_rows = [["Column A", "Column B"], ["foo", "bar"]] + [["", ""] for _ in range(40)]
    late_rows.append(["trial balance", "account code"])
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files=[
                (
                    "files",
                    (
                        "trial-balance-netherlands-fy2025.xlsx",
                        _xlsx_bytes(
                            [
                                ["Account Code", "Account Name", "Debit", "Credit", "Fiscal Year", "Entity"],
                                ["4000", "Revenue", "0", "1200", "FY2025", "GlobalTech Netherlands BV"],
                            ],
                            sheet_name="Trial Balance",
                        ),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ),
                ),
                (
                    "files",
                    (
                        "late-only.xlsx",
                        _xlsx_bytes(late_rows),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ),
                ),
            ],
        )
    ).json()

    assert (await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).status_code == 201

    async with app_session() as session:
        loaded = {
            doc["original_filename"]: await load_classification(session, uuid.UUID(doc["id"]))
            for doc in uploaded
        }

    assert loaded["trial-balance-netherlands-fy2025.xlsx"].document_type == "Trial Balance"
    assert loaded["trial-balance-netherlands-fy2025.xlsx"].relevance == "relevant"
    assert loaded["late-only.xlsx"].document_type == "Unknown"


async def test_out_of_scope_upload_is_stored_but_skipped_from_requirements_processing(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files=[
                (
                    "files",
                    (
                        "relevant-services.pdf",
                        _pdf_bytes(
                            "Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2025."
                        ),
                        "application/pdf",
                    ),
                ),
                (
                    "files",
                    (
                        "wrong-year-services.pdf",
                        _pdf_bytes(
                            "Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2024."
                        ),
                        "application/pdf",
                    ),
                ),
            ],
        )
    ).json()

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201
    assert started.json()["skipped_documents"] == [
        {
            "document_id": uploaded[1]["id"],
            "filename": "wrong-year-services.pdf",
            "reason": "Fiscal year does not match FY2025.",
        }
    ]

    async with app_session() as session:
        relevant_doc = await session.get(Document, uuid.UUID(uploaded[0]["id"]))
        skipped_doc = await session.get(Document, uuid.UUID(uploaded[1]["id"]))
        skipped_chunks = (
            await session.execute(
                select(DocumentChunk).where(DocumentChunk.document_id == uuid.UUID(uploaded[1]["id"]))
            )
        ).scalars().all()

    assert relevant_doc.status == "embedded"
    assert skipped_doc.status == "uploaded"
    assert skipped_chunks == []

    async with app_session() as session:
        skipped_doc = await session.get(Document, uuid.UUID(uploaded[1]["id"]))
        skipped_doc.status = "embedded"
        session.add(
            DocumentChunk(
                document_id=uuid.UUID(uploaded[1]["id"]),
                chunk_index=0,
                content="Service agreement GlobalTech Netherlands BV Territory Netherlands FY2024.",
                embedding=app.state.embedder.embed_documents(["Service agreement FY2024"])[0],
            )
        )
        await session.commit()

    async with app_session() as session:
        documents = await retrieve_documents(
            session,
            uuid.UUID(eid),
            app.state.embedder,
            "service agreement GlobalTech Netherlands BV FY2024",
            k=10,
        )

    assert "wrong-year-services.pdf" not in {document.filename for document in documents}


async def test_shared_usable_source_filter_is_the_future_graphrag_guard(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    skipped_bytes = _pdf_bytes("Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2024.")
    skipped_doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("wrong-year-services.pdf", skipped_bytes, "application/pdf")},
        )
    ).json()[0]
    await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})

    started = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).json()
    target = started["requirements"][0]
    supplement = await client.post(
        f"/coverage/{target['id']}/supplements",
        data={"kind": "upload"},
        files={"file": ("wrong-year-services.pdf", skipped_bytes, "application/pdf")},
    )
    assert supplement.status_code == 201

    async with app_session() as session:
        supplement_doc_ids = set(
            (await session.execute(
                select(Document.id)
                .join(Source, Source.id == Document.source_id)
                .where(Source.engagement_id == uuid.UUID(eid), Source.kind == SourceKind.supplement)
            )).scalars().all()
        )
        usable_ids = set(
            (await session.execute(
                select(Document.id)
                .join(Source, Source.id == Document.source_id)
                .outerjoin(DocumentClassification, DocumentClassification.document_id == Document.id)
                .where(usable_source_filter())
            )).scalars().all()
        )

    assert uuid.UUID(skipped_doc["id"]) not in usable_ids
    assert supplement_doc_ids and not (supplement_doc_ids & usable_ids)
    assert supplement.json()["status"] != "present"
    assert not supplement.json()["evidence"]


async def test_document_with_different_jurisdiction_is_out_of_scope(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={
                "files": (
                    "germany-services.pdf",
                    _pdf_bytes("Service agreement for GlobalTech Netherlands BV. Territory Germany. FY2025."),
                    "application/pdf",
                )
            },
        )
    ).json()[0]

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})

    assert started.status_code == 201
    assert started.json()["skipped_documents"] == [
        {
            "document_id": doc["id"],
            "filename": "germany-services.pdf",
            "reason": "Jurisdiction does not match Netherlands.",
        }
    ]


async def test_document_with_different_entity_is_out_of_scope(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files={
                "files": (
                    "trial-balance-netherlands-fy2025.csv",
                    b"Account Code,Account Name,Debit,Credit,Fiscal Year,Entity\n4000,Revenue,0,1200,FY2025,GlobalTech Germany GmbH\n",
                    "text/csv",
                )
            },
        )
    ).json()[0]

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})

    assert started.status_code == 201
    assert started.json()["skipped_documents"] == [
        {
            "document_id": doc["id"],
            "filename": "trial-balance-netherlands-fy2025.csv",
            "reason": "Entity does not match GlobalTech Netherlands BV.",
        }
    ]


async def test_out_of_scope_uploaded_supplement_is_stored_but_not_accepted(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    skipped_bytes = _pdf_bytes("Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2024.")
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "agreements"},
        files={"files": ("wrong-year-services.pdf", skipped_bytes, "application/pdf")},
    )
    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.json()["skipped_documents"][0]["filename"] == "wrong-year-services.pdf"
    target = started.json()["requirements"][0]

    supplemented = await client.post(
        f"/coverage/{target['id']}/supplements",
        data={"kind": "upload"},
        files={"file": ("wrong-year-services.pdf", skipped_bytes, "application/pdf")},
    )

    assert supplemented.status_code == 201
    assert supplemented.json()["status"] != "present"
    assert not supplemented.json()["evidence"]
    aggregate = (await client.get(f"/engagements/{eid}")).json()
    supplement_docs = [
        doc
        for source in aggregate["sources"]
        if source["kind"] == "supplement"
        for doc in source["documents"]
    ]
    assert supplement_docs[0]["status"] == "uploaded"

    async with app_session() as session:
        supplement = (await session.execute(select(CoverageSupplement))).scalar_one()
        doc = await session.get(Document, uuid.UUID(supplement_docs[0]["id"]))
        classification = await load_classification(session, doc.id)

    assert supplement.source_context == "supplement"
    assert str(supplement.target_requirement_id) == target["id"]
    assert classification.relevance == "out_of_scope"
    assert doc.extraction_status == "skipped_out_of_scope"


async def test_relevant_uploaded_supplement_records_target_and_extracts_facts(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("notes.txt", b"placeholder text with nothing relevant", "text/plain")},
    )
    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    target = started.json()["requirements"][0]

    supplemented = await client.post(
        f"/coverage/{target['id']}/supplements",
        data={"kind": "upload"},
        files={
            "file": (
                "trial-balance-netherlands-fy2025.csv",
                b"Account Code,Account Name,Debit,Credit,Fiscal Year,Entity\n4000,Revenue,0,1200,FY2025,GlobalTech Netherlands BV\n",
                "text/csv",
            )
        },
    )

    assert supplemented.status_code == 201
    assert supplemented.json()["status"] == "present"

    async with app_session() as session:
        supplement = (await session.execute(select(CoverageSupplement))).scalar_one()
        facts = (await session.execute(select(ExtractedFact))).scalars().all()
        runs = (await session.execute(select(ExtractionRun))).scalars().all()
        doc = await session.get(Document, supplement.document_id)
        classification = await load_classification(session, doc.id)

    assert supplement.source_context == "supplement"
    assert str(supplement.target_requirement_id) == target["id"]
    assert classification.document_type == "Trial Balance"
    assert doc.extraction_status in {"extracted", "partially_extracted"}
    assert runs
    assert facts


async def test_ambiguous_classification_uses_llm_fallback_with_retry(client):
    class FlakyFallback:
        def __init__(self) -> None:
            self.calls = 0

        def classify(self, payload):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("provider timeout")
            return {
                "primary_type": "Service Agreement",
                "observed_signals": ["service fee clause", "defined parties"],
                "supporting_quotes": ["The service provider charges cost plus five percent."],
                "candidate_tags": ["Services", "Intercompany"],
                "candidate_scope_values": {
                    "entity": "GlobalTech Netherlands BV",
                    "jurisdiction": "Netherlands",
                    "fiscal_year": "FY2025",
                },
            }

    fallback = FlakyFallback()
    app.state.classification_fallback = fallback
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={
                "files": (
                    "ambiguous-source.txt",
                    b"The service provider charges cost plus five percent for GlobalTech Netherlands BV in FY2025.",
                    "text/plain",
                )
            },
        )
    ).json()[0]

    assert (await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).status_code == 201

    async with app_session() as session:
        loaded = await load_classification(session, uuid.UUID(doc["id"]))

    assert fallback.calls == 2
    assert loaded.document_type == "Service Agreement"
    assert loaded.relevance == "relevant"
    assert loaded.llm_supporting_quotes == ["The service provider charges cost plus five percent."]
    assert "provider timeout" in loaded.diagnostics["fallback_errors"][0]


async def test_failed_llm_classification_degrades_to_unknown_with_diagnostics(client):
    class DownFallback:
        def __init__(self) -> None:
            self.calls = 0

        def classify(self, payload):
            self.calls += 1
            raise RuntimeError("provider unavailable")

    fallback = DownFallback()
    app.state.classification_fallback = fallback
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("ambiguous-source.txt", b"ambiguous working paper", "text/plain")},
        )
    ).json()[0]

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})

    assert started.status_code == 201
    async with app_session() as session:
        loaded = await load_classification(session, uuid.UUID(doc["id"]))

    assert fallback.calls == 2
    assert loaded.document_type == "Unknown"
    assert loaded.relevance == "unknown"
    assert loaded.diagnostics["fallback_errors"] == ["provider unavailable", "provider unavailable"]


async def test_invalid_llm_classification_degrades_to_unknown(client):
    class InvalidFallback:
        def classify(self, payload):
            return {
                "primary_type": "Invented Type",
                "observed_signals": ["something"],
                "supporting_quotes": ["something"],
                "candidate_tags": [],
                "candidate_scope_values": {},
            }

    app.state.classification_fallback = InvalidFallback()
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("ambiguous-source.txt", b"ambiguous working paper", "text/plain")},
        )
    ).json()[0]

    assert (await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).status_code == 201

    async with app_session() as session:
        loaded = await load_classification(session, uuid.UUID(doc["id"]))

    assert loaded.document_type == "Unknown"
    assert loaded.relevance == "unknown"
    assert "Invented Type" in loaded.diagnostics["fallback_errors"][0]


def app_session():
    from app.main import app

    return app.state.session_factory()
