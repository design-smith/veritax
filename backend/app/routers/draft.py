from __future__ import annotations

import asyncio
import gc
import logging
import re
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from ..auth import AuthUser
from ..config import settings
from ..coverage_readiness import draft_readiness_for_rows
from ..corpus import DocContext, context_chars, document_filename_map, retrieve_documents, union_docs
from ..diagnostics import rss_mb
from ..evidence_quality import assessment_scope_instruction, scoped_query
from ..deps import (
    assert_owner,
    get_current_user,
    get_drafter,
    get_embedder,
    get_session,
    get_session_factory,
    require_engagement_owner,
)
from ..docx_export import build_document
from ..drafting import Drafter, DraftResult
from ..embeddings import Embedder
from ..models import (
    CitationKind,
    DraftCitation,
    DraftSection,
    DraftStatus,
    Engagement,
    RequirementCoverage,
)
from ..requirements import resolve_requirements
from ..schemas import DraftCitationRead, DraftResponse, DraftSectionPatch, DraftSectionRead, DraftSummary

router = APIRouter(tags=["draft"])
log = logging.getLogger("veritax")

REGISTER = "local"
DRAFT_DOCUMENT_TITLE = "Transfer Pricing Local File"
_INLINE_MARKER = re.compile(r"\[(\d+)\]")
_OBJECT_MARKER = re.compile(r"\[\[(table|chart):([^\]]+)\]\]")
_NUMERIC_TOKEN = re.compile(
    r"(?<![\w\[])(?:[$€£]\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|percent|million|billion|bn|m|k)?",
    re.IGNORECASE,
)


def _generated_on() -> str:
    return datetime.now(timezone.utc).strftime("%B %d, %Y").replace(" 0", " ")


def _draft_mode() -> str:
    provider = settings.llm_provider.strip().lower()
    if provider:
        return provider
    if settings.deepseek_api_key:
        return "deepseek"
    if settings.anthropic_api_key:
        return "anthropic"
    return "fake"


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _doc_by_label(documents: list[DocContext]) -> dict[str, DocContext]:
    out: dict[str, DocContext] = {}
    for doc in documents:
        out[doc.filename] = doc
        out[doc.filename.lower()] = doc
    return out


def _substantive_sentences(content: str) -> list[str]:
    sentences: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        split_line = re.sub(r"([.!?](?:\[\d+\])?)\s+", "\\1\n", line)
        for part in split_line.splitlines():
            text = part.strip()
            visible = _OBJECT_MARKER.sub("", _INLINE_MARKER.sub("", text)).strip()
            if len(re.sub(r"[^A-Za-z]", "", visible)) >= 12:
                sentences.append(text)
    return sentences


def _number_key(value: str) -> str:
    return re.sub(r"\D", "", value)


def _validate_draft_result(result: DraftResult, documents: list[DocContext], fname_to_docid: dict[str, str]) -> None:
    content = result.content or ""
    if not content.strip():
        raise RuntimeError("draft returned empty content")
    if not result.citations:
        raise RuntimeError("draft returned no citations")

    content_markers = {int(m.group(1)) for m in _INLINE_MARKER.finditer(content)}
    citation_markers = {c.marker for c in result.citations}
    if not content_markers:
        raise RuntimeError("draft content has no inline citation markers")
    missing_records = content_markers - citation_markers
    missing_inline = citation_markers - content_markers
    if missing_records:
        raise RuntimeError(f"draft has uncaptured citation marker(s): {sorted(missing_records)}")
    if missing_inline:
        raise RuntimeError(f"draft returned citation(s) not used in content: {sorted(missing_inline)}")
    citation_by_marker = {c.marker: c for c in result.citations}

    for sentence in _substantive_sentences(content):
        markers = {int(m.group(1)) for m in _INLINE_MARKER.finditer(sentence)}
        if not markers:
            raise RuntimeError(f"draft factual sentence lacks inline citation: {sentence[:160]}")
        quote_text = " ".join(citation_by_marker[m].quote for m in markers if m in citation_by_marker)
        scrubbed = _OBJECT_MARKER.sub("", _INLINE_MARKER.sub("", sentence))
        for number in _NUMERIC_TOKEN.findall(scrubbed):
            key = _number_key(number)
            if key and key not in _number_key(quote_text):
                raise RuntimeError(f"draft number '{number.strip()}' is not present in the cited quote")

    table_ids = {str(t.get("id")) for t in result.tables}
    chart_ids = {str(c.get("id")) for c in result.charts}
    for kind, obj_id in _OBJECT_MARKER.findall(content):
        if kind == "table" and obj_id not in table_ids:
            raise RuntimeError(f"draft referenced missing table: {obj_id}")
        if kind == "chart" and obj_id not in chart_ids:
            raise RuntimeError(f"draft referenced missing chart: {obj_id}")

    fname_ci = {name.lower(): doc_id for name, doc_id in fname_to_docid.items()}
    docs = _doc_by_label(documents)
    for citation in result.citations:
        if citation.kind == "web":
            if not citation.url:
                raise RuntimeError(f"web citation [{citation.marker}] is missing a URL")
            continue
        if citation.kind != "document":
            raise RuntimeError(f"unsupported citation kind for [{citation.marker}]: {citation.kind}")
        if citation.source_label not in fname_to_docid and citation.source_label.lower() not in fname_ci:
            raise RuntimeError(f"document citation [{citation.marker}] does not map to an uploaded document: {citation.source_label}")
        quote = _norm(citation.quote)
        if len(quote) < 16:
            raise RuntimeError(f"document citation [{citation.marker}] quote is too short to verify")
        doc = docs.get(citation.source_label) or docs.get(citation.source_label.lower())
        if doc is not None and quote not in _norm(doc.text):
            raise RuntimeError(f"document citation [{citation.marker}] quote was not found in retrieved source context")


# ── Read helpers ─────────────────────────────────────────────────────────────
def _to_read(section: DraftSection) -> DraftSectionRead:
    return DraftSectionRead(
        id=section.id,
        requirement_key=section.requirement_key,
        element_order=section.element_order,
        element_name=section.element_name,
        status=section.status,
        content=section.content,
        tables=section.tables or [],
        charts=section.charts or [],
        error=section.error,
        citations=[DraftCitationRead.model_validate(c) for c in section.citations],
    )


def _summary(sections: list[DraftSection]) -> DraftSummary:
    def n(st: DraftStatus) -> int:
        return sum(1 for s in sections if s.status == st)

    return DraftSummary(
        total=len(sections),
        drafted=n(DraftStatus.drafted),
        pending=n(DraftStatus.pending) + n(DraftStatus.drafting),
        failed=n(DraftStatus.failed),
    )


async def _load_sections(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> list[DraftSection]:
    return list(
        (
            await session.execute(
                select(DraftSection)
                .where(DraftSection.engagement_id == engagement_id, DraftSection.jurisdiction == jurisdiction)
                .order_by(DraftSection.element_order)
            )
        ).scalars()
    )


async def _response(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> DraftResponse:
    sections = await _load_sections(session, engagement_id, jurisdiction)
    return DraftResponse(
        jurisdiction=jurisdiction,
        draft_mode=_draft_mode(),
        summary=_summary(sections),
        sections=[_to_read(s) for s in sections],
    )


async def _draft_blocked_by_coverage(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> str | None:
    rows = (
        await session.execute(
            select(RequirementCoverage).where(
                RequirementCoverage.engagement_id == engagement_id,
                RequirementCoverage.jurisdiction == jurisdiction,
            )
        )
    ).scalars().all()
    return draft_readiness_for_rows(rows).blocker


# ── Drafting loop (reads documents DIRECTLY — no vector search) ───────────────
async def _coverage_notes(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> dict[str, str]:
    rows = (
        await session.execute(
            select(RequirementCoverage).where(
                RequirementCoverage.engagement_id == engagement_id,
                RequirementCoverage.jurisdiction == jurisdiction,
            )
        )
    ).scalars().all()
    notes: dict[str, str] = {}
    for r in rows:
        parts = []
        if r.whats_present:
            parts.append(f"already present — {r.whats_present}")
        if r.whats_missing:
            parts.append(f"gap to fill — {r.whats_missing}")
        if parts:
            notes[r.requirement_key] = "; ".join(parts)
    return notes


async def _write_result(session: AsyncSession, section: DraftSection, result: DraftResult,
                        fname_to_docid: dict[str, str], documents: list[DocContext]) -> None:
    _validate_draft_result(result, documents, fname_to_docid)
    section.content = result.content
    section.tables = result.tables
    section.charts = result.charts
    section.model = settings.draft_model
    section.status = DraftStatus.drafted
    section.error = None
    section.status_updated_at = datetime.now(timezone.utc)
    section.drafted_at = datetime.now(timezone.utc)
    await session.execute(delete(DraftCitation).where(DraftCitation.section_id == section.id))
    fname_ci = {name.lower(): doc_id for name, doc_id in fname_to_docid.items()}
    for c in result.citations:
        doc_id = (
            fname_to_docid.get(c.source_label) or fname_ci.get(c.source_label.lower())
            if c.kind == "document" else None
        )
        session.add(
            DraftCitation(
                section_id=section.id,
                marker=c.marker,
                kind=CitationKind(c.kind),
                document_id=uuid.UUID(doc_id) if doc_id else None,
                url=c.url,
                source_label=c.source_label,
                quote=c.quote,
            )
        )


async def _draft_one(session: AsyncSession, section: DraftSection, element, documents: list[DocContext],
                     coverage_note: str, scope_note: str, drafter: Drafter,
                     fname_to_docid: dict[str, str]) -> None:
    section.status = DraftStatus.drafting
    section.error = None
    section.status_updated_at = datetime.now(timezone.utc)
    await session.commit()
    log.info("draft_one START section=%s '%s' docs=%d", section.id, element.element_name, len(documents))
    t0 = time.monotonic()
    try:
        if not documents:
            raise RuntimeError("no retrieved source context for this section; add or re-index source material")
        result = await asyncio.to_thread(drafter.draft, element, REGISTER, documents, coverage_note, scope_note)
        await _write_result(session, section, result, fname_to_docid, documents)
        log.info("draft_one DONE section=%s '%s' in %.1fs", section.id, element.element_name, time.monotonic() - t0)
    except Exception as exc:  # noqa: BLE001 - record failure per section, keep the loop going
        log.exception("draft_one FAILED section=%s '%s' after %.1fs", section.id, element.element_name, time.monotonic() - t0)
        section.status = DraftStatus.failed
        section.status_updated_at = datetime.now(timezone.utc)
        section.error = str(exc)[:1000]


async def _draft_batch(session: AsyncSession, sections: list[DraftSection], elements: dict,
                       docs_by_key: dict[str, list[DocContext]], notes: dict[str, str],
                       scope_notes: dict[str, str], drafter: Drafter,
                       fname_to_docid: dict[str, str]) -> None:
    for section in sections:
        section.status = DraftStatus.drafting
        section.error = None
        section.status_updated_at = datetime.now(timezone.utc)
    await session.commit()

    batch_elements = [elements[s.requirement_key] for s in sections]
    shared_docs = union_docs([docs_by_key.get(s.requirement_key, []) for s in sections])
    if not shared_docs:
        for section in sections:
            section.status = DraftStatus.failed
            section.status_updated_at = datetime.now(timezone.utc)
            section.error = "no retrieved source context for this draft batch; add or re-index source material"
        await session.commit()
        return
    coverage_notes = {i: notes.get(s.requirement_key, "") for i, s in enumerate(sections, 1)}
    section_scope_notes = {i: scope_notes.get(s.requirement_key, "") for i, s in enumerate(sections, 1)}
    names = ", ".join(s.element_name for s in sections)
    log.info("draft_batch START %d section(s): %s", len(sections), names)
    t0 = time.monotonic()
    try:
        results = await asyncio.to_thread(
            drafter.draft_batch, batch_elements, REGISTER, shared_docs, coverage_notes, section_scope_notes
        )
    except Exception as exc:  # noqa: BLE001 - fail this batch, then keep later batches moving
        log.exception("draft_batch FAILED %d section(s) after %.1fs", len(sections), time.monotonic() - t0)
        for section in sections:
            section.status = DraftStatus.failed
            section.status_updated_at = datetime.now(timezone.utc)
            section.error = str(exc)[:1000]
        await session.commit()
        return

    for i, section in enumerate(sections, 1):
        result = results.get(i)
        if result is None:
            section.status = DraftStatus.failed
            section.status_updated_at = datetime.now(timezone.utc)
            section.error = "no draft returned for this section"
        else:
            try:
                await _write_result(session, section, result, fname_to_docid, shared_docs)
            except Exception as exc:  # noqa: BLE001 - fail the bad section, keep the batch result visible
                section.status = DraftStatus.failed
                section.status_updated_at = datetime.now(timezone.utc)
                section.error = str(exc)[:1000]
    await session.commit()
    log.info("draft_batch DONE %d/%d section(s) in %.1fs",
             sum(1 for i in range(1, len(sections) + 1) if i in results), len(sections), time.monotonic() - t0)


async def _mark_pending_failed(session_factory: async_sessionmaker, engagement_id: uuid.UUID,
                               jurisdiction: str, error: str) -> None:
    async with session_factory() as session:
        rows = (
            await session.execute(
                select(DraftSection).where(
                    DraftSection.engagement_id == engagement_id,
                    DraftSection.jurisdiction == jurisdiction,
                    DraftSection.status.in_([DraftStatus.pending, DraftStatus.drafting]),
                )
            )
        ).scalars().all()
        for row in rows:
            row.status = DraftStatus.failed
            row.status_updated_at = datetime.now(timezone.utc)
            row.error = error[:1000]
        await session.commit()


async def _find_drafted_twin(session: AsyncSession, engagement_id: uuid.UUID, element) -> DraftSection | None:
    return None
    """A completed section for the same element elsewhere in the engagement. Shared base templates give
    jurisdictions the same (name, order), and the prose is grounded in the same documents — so reuse it:
    no regeneration, and the shared narrative reads identically across the jurisdiction files.
    ponytail: identity = (name, order); DraftSection has no description column and a cross-base name+order
    collision within one engagement is near-zero. Add element_description to the table if that changes."""
    return (
        await session.execute(
            select(DraftSection)
            .where(
                DraftSection.engagement_id == engagement_id,
                DraftSection.element_name == element.element_name,
                DraftSection.element_order == element.order,
                DraftSection.status == DraftStatus.drafted,
            )
            .options(selectinload(DraftSection.citations))
            .limit(1)
        )
    ).scalar_one_or_none()


async def _copy_draft(session: AsyncSession, target: DraftSection, twin: DraftSection) -> None:
    target.content = twin.content
    target.tables = twin.tables
    target.charts = twin.charts
    target.model = twin.model
    target.status = DraftStatus.drafted
    target.error = None
    target.status_updated_at = datetime.now(timezone.utc)
    target.drafted_at = datetime.now(timezone.utc)
    await session.execute(delete(DraftCitation).where(DraftCitation.section_id == target.id))
    for c in twin.citations:
        session.add(DraftCitation(
            section_id=target.id, marker=c.marker, kind=c.kind, document_id=c.document_id,
            url=c.url, source_label=c.source_label, quote=c.quote,
        ))


async def _run_draft_serial_unused(session_factory: async_sessionmaker, drafter: Drafter, embedder: Embedder,
                                   engagement_id: uuid.UUID, jurisdiction: str) -> None:
    async with session_factory() as session:
        elements = {e.requirement_key: e for e in resolve_requirements(jurisdiction)}
        fname_to_docid = await document_filename_map(session, engagement_id)
        engagement = await session.get(Engagement, engagement_id)
        entity_name = engagement.entity.name if engagement and engagement.entity else None
        notes = await _coverage_notes(session, engagement_id, jurisdiction)
        pending = (
            await session.execute(
                select(DraftSection).where(
                    DraftSection.engagement_id == engagement_id,
                    DraftSection.jurisdiction == jurisdiction,
                    DraftSection.status == DraftStatus.pending,
                )
            )
        ).scalars().all()
        # Pass 1: reuse a drafted twin from another jurisdiction (no LLM, keeps files consistent).
        remaining: list[DraftSection] = []
        for section in pending:
            element = elements.get(section.requirement_key)
            if element is None:
                section.status = DraftStatus.failed
                section.status_updated_at = datetime.now(timezone.utc)
                section.error = "requirement not found in seed"
                await session.commit()
                continue
            twin = await _find_drafted_twin(session, engagement_id, element)
            if twin is not None and twin.id != section.id:
                await _copy_draft(session, section, twin)
                await session.commit()
            else:
                remaining.append(section)
        # Pass 2: draft the rest with one section's context in memory at a time.
        for section in remaining:
            element = elements[section.requirement_key]
            documents = await retrieve_documents(
                session,
                engagement_id,
                embedder,
                scoped_query(element, entity_name=entity_name, jurisdiction=jurisdiction),
            )
            await _draft_one(session, section, element, documents,
                             notes.get(section.requirement_key, ""),
                             assessment_scope_instruction(
                                 element, entity_name=entity_name, jurisdiction=jurisdiction
                             ),
                             drafter, fname_to_docid)
            await session.commit()
            documents.clear()
            gc.collect()


async def run_draft(session_factory: async_sessionmaker, drafter: Drafter, embedder: Embedder,
                    engagement_id: uuid.UUID, jurisdiction: str) -> None:
    log.info("run_draft START engagement=%s jurisdiction=%s drafter=%s register=%s",
             engagement_id, jurisdiction, type(drafter).__name__, REGISTER)
    t0 = time.monotonic()
    try:
        async with session_factory() as session:
            blocked = await _draft_blocked_by_coverage(session, engagement_id, jurisdiction)
            if blocked:
                log.info("run_draft BLOCKED engagement=%s jurisdiction=%s reason=%s", engagement_id, jurisdiction, blocked)
                now = datetime.now(timezone.utc)
                pending_rows = (
                    await session.execute(
                        select(DraftSection).where(
                            DraftSection.engagement_id == engagement_id,
                            DraftSection.jurisdiction == jurisdiction,
                            DraftSection.status.in_([DraftStatus.pending, DraftStatus.drafting]),
                        )
                    )
                ).scalars().all()
                for row in pending_rows:
                    row.status = DraftStatus.failed
                    row.status_updated_at = now
                    row.error = blocked
                await session.commit()
                return

            elements = {e.requirement_key: e for e in resolve_requirements(jurisdiction)}
            fname_to_docid = await document_filename_map(session, engagement_id)
            engagement = await session.get(Engagement, engagement_id)
            entity_name = engagement.entity.name if engagement and engagement.entity else None
            notes = await _coverage_notes(session, engagement_id, jurisdiction)
            pending = (
                await session.execute(
                    select(DraftSection).where(
                        DraftSection.engagement_id == engagement_id,
                        DraftSection.jurisdiction == jurisdiction,
                        DraftSection.status == DraftStatus.pending,
                    ).order_by(DraftSection.element_order)
                )
            ).scalars().all()
            log.info("run_draft: %d pending section(s)", len(pending))

            remaining: list[DraftSection] = []
            reused = 0
            for section in pending:
                element = elements.get(section.requirement_key)
                if element is None:
                    section.status = DraftStatus.failed
                    section.status_updated_at = datetime.now(timezone.utc)
                    section.error = "requirement not found in seed"
                    await session.commit()
                    continue
                twin = await _find_drafted_twin(session, engagement_id, element)
                if twin is not None and twin.id != section.id:
                    await _copy_draft(session, section, twin)
                    await session.commit()
                    reused += 1
                else:
                    remaining.append(section)

            batch_size = 1
            log.info("run_draft: %d reused from twin, %d to draft in batches of %d",
                     reused, len(remaining), batch_size)
            for start in range(0, len(remaining), batch_size):
                group = remaining[start:start + batch_size]
                if batch_size == 1:
                    section = group[0]
                    element = elements[section.requirement_key]
                    documents: list[DocContext] = []
                    try:
                        documents = await retrieve_documents(
                            session,
                            engagement_id,
                            embedder,
                            scoped_query(element, entity_name=entity_name, jurisdiction=jurisdiction),
                        )
                        log.info(
                            "run_draft: section context ready order=%d key=%s docs=%d context_chars=%d rss=%s",
                            section.element_order,
                            section.requirement_key,
                            len(documents),
                            context_chars(documents),
                            rss_mb(),
                        )
                    except Exception as exc:  # noqa: BLE001 - provider/search failure affects one section
                        log.exception(
                            "run_draft: context retrieval FAILED order=%d key=%s",
                            section.element_order,
                            section.requirement_key,
                        )
                        section.status = DraftStatus.failed
                        section.status_updated_at = datetime.now(timezone.utc)
                        section.error = str(exc)[:1000]
                        await session.commit()
                        continue
                    if not documents:
                        section.status = DraftStatus.failed
                        section.status_updated_at = datetime.now(timezone.utc)
                        section.error = "no retrieved source context for this section; add or re-index source material"
                        await session.commit()
                        continue
                    await _draft_one(session, section, element, documents,
                                     notes.get(section.requirement_key, ""),
                                     assessment_scope_instruction(
                                         element, entity_name=entity_name, jurisdiction=jurisdiction
                                     ),
                                     drafter, fname_to_docid)
                    await session.commit()
                    documents.clear()
                    gc.collect()
                else:
                    for section in group:
                        element = elements[section.requirement_key]
                        documents = await retrieve_documents(
                            session,
                            engagement_id,
                            embedder,
                            scoped_query(element, entity_name=entity_name, jurisdiction=jurisdiction),
                        )
                        await _draft_one(session, section, element, documents,
                                         notes.get(section.requirement_key, ""),
                                         assessment_scope_instruction(
                                             element, entity_name=entity_name, jurisdiction=jurisdiction
                                         ),
                                         drafter, fname_to_docid)
                        await session.commit()
                        documents.clear()
                        gc.collect()

        log.info("run_draft DONE engagement=%s jurisdiction=%s in %.1fs",
                 engagement_id, jurisdiction, time.monotonic() - t0)
    except Exception as exc:  # noqa: BLE001 - never leave the UI polling pending forever
        log.exception("run_draft CRASHED engagement=%s jurisdiction=%s after %.1fs",
                      engagement_id, jurisdiction, time.monotonic() - t0)
        await _mark_pending_failed(session_factory, engagement_id, jurisdiction, str(exc))


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/engagements/{engagement_id}/draft", response_model=DraftResponse, status_code=201)
async def start_draft(
    engagement_id: uuid.UUID,
    background: BackgroundTasks,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    drafter: Drafter = Depends(get_drafter),
    embedder: Embedder = Depends(get_embedder),
    factory: async_sessionmaker = Depends(get_session_factory),
    _owner: Engagement = Depends(require_engagement_owner),
) -> DraftResponse:
    elements = resolve_requirements(jurisdiction)
    if not elements:
        raise HTTPException(status_code=404, detail=f"no requirements defined for '{jurisdiction}'")
    blocked = await _draft_blocked_by_coverage(session, engagement_id, jurisdiction)
    if blocked:
        raise HTTPException(status_code=409, detail=blocked)

    rows = [
        {
            "id": uuid.uuid4(),
            "engagement_id": engagement_id,
            "jurisdiction": jurisdiction,
            "requirement_key": e.requirement_key,
            "element_order": e.order,
            "element_name": e.element_name,
            "status": DraftStatus.pending,
            "status_updated_at": datetime.now(timezone.utc),
        }
        for e in elements
    ]
    stmt = pg_insert(DraftSection).values(rows).on_conflict_do_nothing(
        index_elements=["engagement_id", "jurisdiction", "requirement_key"]
    )
    result = await session.execute(stmt)
    await session.commit()

    if (result.rowcount or 0) > 0:
        background.add_task(run_draft, factory, drafter, embedder, engagement_id, jurisdiction)
    return await _response(session, engagement_id, jurisdiction)


@router.get("/engagements/{engagement_id}/draft", response_model=DraftResponse)
async def get_draft(
    engagement_id: uuid.UUID,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> DraftResponse:
    return await _response(session, engagement_id, jurisdiction)


_LEADING_HEADING = re.compile(r"^\s*#{1,4}\s+.*\n+")  # drop a leading md heading the drafter may include


@router.get("/engagements/{engagement_id}/draft.docx")
async def download_draft_docx(
    engagement_id: uuid.UUID,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    owner: Engagement = Depends(require_engagement_owner),
) -> Response:
    """The finished jurisdiction as a native Word file — cover, headings, native tables + editable charts."""
    blocked = await _draft_blocked_by_coverage(session, engagement_id, jurisdiction)
    if blocked:
        raise HTTPException(status_code=409, detail=blocked)
    sections = await _load_sections(session, engagement_id, jurisdiction)
    expected = len(resolve_requirements(jurisdiction))
    drafted = [s for s in sections if s.status == DraftStatus.drafted and s.content]
    if expected == 0 or len(sections) != expected or len(drafted) != expected:
        raise HTTPException(status_code=409, detail=f"draft not complete for '{jurisdiction}'")
    uncited = [s.element_name for s in drafted if not s.citations]
    if uncited:
        raise HTTPException(status_code=409, detail=f"draft has uncited section(s): {', '.join(uncited[:3])}")
    entity = owner.entity.name if owner.entity else "Entity"
    cover = {
        "documentTitle": DRAFT_DOCUMENT_TITLE,
        "entity": entity,
        "jurisdiction": jurisdiction,
        "status": "Draft prepared for review",
        "preparedBy": "Veritax",
        "preparedOn": _generated_on(),
    }
    doc_sections = [
        {
            "heading": f"{s.element_order}. {s.element_name}",
            "content": _LEADING_HEADING.sub("", s.content or ""),
            "tables": s.tables or [],
            "charts": s.charts or [],
        }
        for s in drafted
    ]
    data = await asyncio.to_thread(build_document, cover, doc_sections)
    name = re.sub(r"[^\w]+", "-", f"{entity} {jurisdiction} Local File").strip("-")
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{name}.docx"'},
    )


@router.patch("/draft-sections/{section_id}", response_model=DraftSectionRead)
async def update_draft_section(
    section_id: uuid.UUID,
    body: DraftSectionPatch,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> DraftSectionRead:
    section = await session.get(DraftSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="draft section not found")
    await assert_owner(session, section.engagement_id, user)
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="draft section content cannot be empty")
    section.content = content
    section.status = DraftStatus.drafted
    section.error = None
    section.status_updated_at = datetime.now(timezone.utc)
    await session.commit()
    updated = (
        await session.execute(
            select(DraftSection)
            .options(selectinload(DraftSection.citations))
            .where(DraftSection.id == section_id)
        )
    ).scalar_one()
    return _to_read(updated)


@router.post("/draft-sections/{section_id}/regenerate", response_model=DraftSectionRead)
async def regenerate_section(
    section_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    drafter: Drafter = Depends(get_drafter),
    embedder: Embedder = Depends(get_embedder),
    user: AuthUser = Depends(get_current_user),
) -> DraftSectionRead:
    section = await session.get(DraftSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="draft section not found")
    await assert_owner(session, section.engagement_id, user)
    element = next(
        (e for e in resolve_requirements(section.jurisdiction) if e.requirement_key == section.requirement_key),
        None,
    )
    if element is None:
        raise HTTPException(status_code=422, detail="requirement not found for section")
    blocked = await _draft_blocked_by_coverage(session, section.engagement_id, section.jurisdiction)
    if blocked:
        raise HTTPException(status_code=409, detail=blocked)

    fname_to_docid = await document_filename_map(session, section.engagement_id)
    engagement = await session.get(Engagement, section.engagement_id)
    entity_name = engagement.entity.name if engagement and engagement.entity else None
    documents = await retrieve_documents(
        session,
        section.engagement_id,
        embedder,
        scoped_query(element, entity_name=entity_name, jurisdiction=section.jurisdiction),
    )
    notes = await _coverage_notes(session, section.engagement_id, section.jurisdiction)
    await _draft_one(session, section, element, documents,
                     notes.get(section.requirement_key, ""),
                     assessment_scope_instruction(element, entity_name=entity_name, jurisdiction=section.jurisdiction),
                     drafter, fname_to_docid)
    await session.commit()
    await session.refresh(section)
    return _to_read(section)
