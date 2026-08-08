from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from .classification_store import load_classification
from .config import settings
from .extraction_eligibility import extraction_eligibility
from .extraction_schemas import schema_entry
from .extraction_store import RunInput, extraction_fingerprint, get_or_create_extraction_run
from .financial_extraction import (
    extract_general_ledger_document,
    extract_invoice_population_document,
    extract_trial_balance_document,
)
from .jobs import enqueue_pipeline_job
from .models import Document, DocumentClassification, DocumentScope, PipelineJobKind, Source
from .processing import extract_text
from .storage import Storage

RUNNER_VERSION = "extraction-job-router-v1"
TERMINAL_ERROR_MARKERS = (
    "no extractable text",
    "ocr",
    "quote validation",
    "quote not found",
    "quote is required",
    "schema validation",
    "unsupported extraction schema",
    "unsupported schema",
)


class TerminalExtractionError(RuntimeError):
    pass


async def queue_extraction_jobs_for_engagement(
    session,
    engagement_id: uuid.UUID,
    *,
    restart: bool = False,
) -> int:
    rows = (
        await session.execute(
            select(Document, DocumentClassification, DocumentScope)
            .join(Source, Source.id == Document.source_id)
            .join(DocumentClassification, DocumentClassification.document_id == Document.id)
            .outerjoin(DocumentScope, DocumentScope.document_id == Document.id)
            .where(Source.engagement_id == engagement_id)
            .order_by(Document.created_at)
        )
    ).all()
    queued = 0
    for doc, classification, scope in rows:
        eligibility = extraction_eligibility(
            document_type=classification.document_type,
            classification_state=_enum_value(classification.classification_state),
            relevance=_enum_value(classification.relevance),
            source_validation_result=scope.source_validation_result if scope else {},
            document_active=doc.is_active,
        )
        if eligibility.status != "pending":
            doc.extraction_status = eligibility.status
            continue
        doc.extraction_status = "pending"
        for schema_key in eligibility.schema_keys:
            await enqueue_pipeline_job(
                session,
                engagement_id=engagement_id,
                kind=PipelineJobKind.extract_document,
                dedupe_key=f"extract_document:{doc.id}:{schema_key}",
                payload={"document_id": str(doc.id), "schema_key": schema_key},
                restart=restart,
            )
            queued += 1
    return queued


async def run_extraction_job(
    session_factory: async_sessionmaker,
    storage: Storage,
    document_id: uuid.UUID,
    schema_key: str,
) -> None:
    async with session_factory() as session:
        doc = await session.get(Document, document_id)
        if doc is None:
            return
        classification = await load_classification(session, doc.id)
        if classification is None:
            doc.extraction_status = "skipped_unknown"
            await session.commit()
            return
        eligibility = extraction_eligibility(
            document_type=classification.document_type,
            classification_state=_enum_value(classification.classification_state),
            relevance=_enum_value(classification.relevance),
            source_validation_result=classification.scope.source_validation_result,
            document_active=doc.is_active,
        )
        if eligibility.status != "pending":
            doc.extraction_status = eligibility.status
            await session.commit()
            return
        if schema_key not in eligibility.schema_keys:
            await _record_terminal_failure(
                session,
                doc,
                schema_key,
                classification.document_type,
                classification.classifier_version,
                f"unsupported schema {schema_key!r} for {classification.document_type}",
            )
            await session.commit()
            return

        try:
            doc.extraction_status = "extracting"
            data = await asyncio.to_thread(storage.get, doc.storage_key)
            if schema_key != "financial_table":
                _require_extractable_text(doc, data)
            if schema_key == "financial_table":
                await _extract_financial(
                    session,
                    doc,
                    data,
                    classification.document_type,
                    classification.classifier_version,
                )
            else:
                await _record_extractor_not_configured(
                    session,
                    doc,
                    schema_key,
                    classification.document_type,
                    classification.classifier_version,
                )
            await session.commit()
        except Exception as exc:
            reason = terminal_extraction_reason(exc)
            if reason is None:
                raise
            await session.rollback()
            doc = await session.get(Document, document_id)
            classification = await load_classification(session, document_id)
            if doc is None or classification is None:
                raise
            await _record_terminal_failure(
                session,
                doc,
                schema_key,
                classification.document_type,
                classification.classifier_version,
                reason,
            )
            await session.commit()


async def _extract_financial(session, doc: Document, data: bytes, document_type: str, classifier_version: str) -> None:
    if document_type == "Trial Balance":
        await extract_trial_balance_document(
            session,
            document=doc,
            data=data,
            classification_type=document_type,
            classification_version=classifier_version,
        )
    elif document_type == "General Ledger":
        await extract_general_ledger_document(
            session,
            document=doc,
            data=data,
            classification_type=document_type,
            classification_version=classifier_version,
        )
    elif document_type == "Invoice Population":
        await extract_invoice_population_document(
            session,
            document=doc,
            data=data,
            classification_type=document_type,
            classification_version=classifier_version,
        )
    else:
        await _record_extractor_not_configured(session, doc, "financial_table", document_type, classifier_version)


async def _record_extractor_not_configured(
    session,
    doc: Document,
    schema_key: str,
    classification_type: str,
    classification_version: str,
) -> None:
    schema = schema_entry(schema_key)
    schema_version = str(schema["schema_version"])
    model_version = settings.resolved_extraction_model()
    fingerprint = extraction_fingerprint(
        document_hash=doc.content_hash,
        classification_type=classification_type,
        classification_version=classification_version,
        schema_version=schema_version,
        runner_version=RUNNER_VERSION,
        model_version=model_version,
    )
    await get_or_create_extraction_run(
        session,
        RunInput(
            engagement_id=await _engagement_id(session, doc),
            document_id=doc.id,
            schema_key=schema_key,
            schema_version=schema_version,
            classification_type=classification_type,
            classification_version=classification_version,
            runner_version=RUNNER_VERSION,
            model_version=model_version,
            fingerprint=fingerprint,
            status="needs_review",
            diagnostics={
                "provider": settings.resolved_extraction_provider(),
                "reason": f"Extractor is not configured for {schema_key}.",
            },
        ),
    )


def _require_extractable_text(doc: Document, data: bytes) -> None:
    text = extract_text(doc.original_filename, doc.content_type, data)
    if not text.strip():
        raise TerminalExtractionError("no extractable text / OCR needed")


def terminal_extraction_reason(exc: BaseException) -> str | None:
    if isinstance(exc, TerminalExtractionError):
        return str(exc)
    message = str(exc).lower()
    if any(marker in message for marker in TERMINAL_ERROR_MARKERS):
        return str(exc)
    return None


async def _record_terminal_failure(
    session,
    doc: Document,
    schema_key: str,
    classification_type: str,
    classification_version: str,
    reason: str,
) -> None:
    doc.error = reason[:1000]
    try:
        schema = schema_entry(schema_key)
    except ValueError:
        doc.extraction_status = "failed"
        return
    schema_version = str(schema["schema_version"])
    fingerprint = extraction_fingerprint(
        document_hash=doc.content_hash,
        classification_type=classification_type,
        classification_version=classification_version,
        schema_version=schema_version,
        runner_version=RUNNER_VERSION,
        model_version="terminal-failure",
    )
    await get_or_create_extraction_run(
        session,
        RunInput(
            engagement_id=await _engagement_id(session, doc),
            document_id=doc.id,
            schema_key=schema_key,
            schema_version=schema_version,
            classification_type=classification_type,
            classification_version=classification_version,
            runner_version=RUNNER_VERSION,
            model_version="terminal-failure",
            fingerprint=fingerprint,
            status="failed",
            diagnostics={"terminal": True, "reason": reason},
        ),
    )


async def _engagement_id(session, doc: Document) -> uuid.UUID:
    source = await session.get(Source, doc.source_id)
    if source is None:
        raise ValueError(f"source not found for document: {doc.id}")
    return source.engagement_id


def _enum_value(value) -> str:
    return getattr(value, "value", value)
