from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from .extraction_schemas import fact_type_rule, schema_entry
from .extraction_store import (
    ExpectedFieldInput,
    ExtractedFactInput,
    FactSourceInput,
    RunInput,
    add_expected_field,
    add_extracted_fact,
    extraction_fingerprint,
    get_or_create_extraction_run,
)
from .models import Document, ExtractionRun, Source
from .processing import extract_text
from .source_locators import validate_source_quote

RUNNER_VERSION = "agreement-extractor-v1"
SCHEMA_KEY = "agreement_core"
EXPECTED_AGREEMENT_FIELDS = (
    "agreement_type",
    "provider",
    "recipient",
    "services_description",
    "effective_date",
    "pricing_method",
    "markup",
)


@dataclass(frozen=True)
class AgreementFact:
    fact_type: str
    value_raw: str
    quote: str
    value_normalized: str | None = None
    unit: str | None = None
    period: str | None = None
    scope_level: str = "transaction"
    page: int | None = None
    locator: str | None = None


@dataclass(frozen=True)
class AgreementExtraction:
    facts: list[AgreementFact] = field(default_factory=list)


class AgreementExtractor(Protocol):
    model_version: str

    def extract(self, text: str, schema: dict) -> AgreementExtraction: ...


async def extract_agreement_document(
    session: AsyncSession,
    *,
    document: Document,
    data: bytes,
    extractor: AgreementExtractor,
    classification_type: str,
    classification_version: str,
) -> object:
    schema = schema_entry(SCHEMA_KEY)
    schema_version = str(schema["schema_version"])
    model_version = getattr(extractor, "model_version", extractor.__class__.__name__)
    text = extract_text(document.original_filename, document.content_type, data)
    extracted = extractor.extract(text, schema)
    accepted: list[tuple[AgreementFact, FactSourceInput, str]] = []
    invalid_facts: list[dict] = []

    for fact in extracted.facts:
        try:
            rule = fact_type_rule(SCHEMA_KEY, fact.fact_type)
            if fact.scope_level not in set(rule.get("allowed_scope_levels", [])):
                raise ValueError(f"scope level {fact.scope_level!r} is not allowed")
            region = validate_source_quote(
                document.original_filename,
                document.content_type,
                data,
                fact.quote,
                page=fact.page,
                locator=fact.locator,
            )
        except ValueError as exc:
            invalid_facts.append({"fact_type": fact.fact_type, "reason": str(exc)})
            continue
        accepted.append((fact, FactSourceInput(
            document_id=document.id,
            page=region.page,
            locator=region.locator,
            quote=fact.quote,
        ), str(rule["value_type"])))

    present = {fact.fact_type for fact, _, _ in accepted}
    missing = [field for field in EXPECTED_AGREEMENT_FIELDS if field not in present]
    status = "extracted" if not missing and not invalid_facts else "partially_extracted"
    fingerprint = extraction_fingerprint(
        document_hash=document.content_hash,
        classification_type=classification_type,
        classification_version=classification_version,
        schema_version=schema_version,
        runner_version=RUNNER_VERSION,
        model_version=model_version,
    )
    result = await get_or_create_extraction_run(
        session,
        RunInput(
            engagement_id=await _engagement_id(session, document),
            document_id=document.id,
            schema_key=SCHEMA_KEY,
            schema_version=schema_version,
            classification_type=classification_type,
            classification_version=classification_version,
            runner_version=RUNNER_VERSION,
            model_version=model_version,
            fingerprint=fingerprint,
            status=status,
            diagnostics={"invalid_facts": invalid_facts},
        ),
    )
    if result.reused:
        return result.run

    for fact, source, value_type in accepted:
        await add_extracted_fact(
            session,
            result.run.id,
            document.id,
            ExtractedFactInput(
                schema_key=SCHEMA_KEY,
                schema_version=schema_version,
                fact_type=fact.fact_type,
                value_raw=fact.value_raw,
                value_normalized=fact.value_normalized,
                value_type=value_type,
                unit=fact.unit,
                period=fact.period,
                scope_level=fact.scope_level,
            ),
            sources=[source],
        )
    for field_name in missing:
        await add_expected_field(
            session,
            result.run.id,
            ExpectedFieldInput(field_name=field_name, status="missing", reason="No source-backed fact extracted."),
        )
    return result.run


async def _engagement_id(session: AsyncSession, document: Document) -> uuid.UUID:
    source = await session.get(Source, document.source_id)
    if source is None:
        raise ValueError(f"source not found for document {document.id}")
    return source.engagement_id
