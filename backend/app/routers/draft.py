from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..config import settings
from ..corpus import DocContext, document_filename_map, element_query, retrieve_documents, retrieve_documents_batch
from ..deps import get_drafter, get_embedder, get_session, get_session_factory
from ..drafting import Drafter
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
from ..schemas import DraftCitationRead, DraftResponse, DraftSectionRead, DraftSummary

router = APIRouter(tags=["draft"])
log = logging.getLogger("veritax")

REGISTER = "planning"  # planning-file voice (forward-looking, management-facing, recommending)


# ── Read helpers ─────────────────────────────────────────────────────────────
def _to_read(section: DraftSection) -> DraftSectionRead:
    return DraftSectionRead(
        id=section.id,
        requirement_key=section.requirement_key,
        element_order=section.element_order,
        element_name=section.element_name,
        status=section.status,
        content=section.content,
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
    return DraftResponse(jurisdiction=jurisdiction, summary=_summary(sections), sections=[_to_read(s) for s in sections])


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


async def _draft_one(session: AsyncSession, section: DraftSection, element, documents: list[DocContext],
                     coverage_note: str, drafter: Drafter, fname_to_docid: dict[str, str]) -> None:
    try:
        result = await asyncio.to_thread(drafter.draft, element, REGISTER, documents, coverage_note)
        section.content = result.content
        section.model = settings.draft_model
        section.status = DraftStatus.drafted
        section.error = None
        section.drafted_at = datetime.now(timezone.utc)
        await session.execute(delete(DraftCitation).where(DraftCitation.section_id == section.id))
        for c in result.citations:
            doc_id = fname_to_docid.get(c.source_label) if c.kind == "document" else None
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
    except Exception as exc:  # noqa: BLE001 - record failure per section, keep the loop going
        section.status = DraftStatus.failed
        section.error = str(exc)[:1000]


async def run_draft(session_factory: async_sessionmaker, drafter: Drafter, embedder: Embedder,
                    engagement_id: uuid.UUID, jurisdiction: str) -> None:
    async with session_factory() as session:
        elements = {e.requirement_key: e for e in resolve_requirements(jurisdiction)}
        fname_to_docid = await document_filename_map(session, engagement_id)
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
        # One embedding call for all sections' queries; per-section pgvector search is free/local.
        queries = {s.requirement_key: element_query(elements[s.requirement_key])
                   for s in pending if s.requirement_key in elements}
        try:
            docs_by_key = await retrieve_documents_batch(session, engagement_id, embedder, queries)
        except Exception:  # noqa: BLE001 - embedding down: draft with no context rather than crash the run
            log.exception("run_draft: query embedding FAILED — sections draft without retrieved context")
            docs_by_key = {}
        for section in pending:
            element = elements.get(section.requirement_key)
            if element is None:
                section.status = DraftStatus.failed
                section.error = "requirement not found in seed"
            else:
                documents = docs_by_key.get(section.requirement_key, [])
                await _draft_one(session, section, element, documents,
                                 notes.get(section.requirement_key, ""), drafter, fname_to_docid)
            await session.commit()


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
) -> DraftResponse:
    if await session.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=404, detail="engagement not found")
    elements = resolve_requirements(jurisdiction)
    if not elements:
        raise HTTPException(status_code=404, detail=f"no requirements defined for '{jurisdiction}'")

    rows = [
        {
            "id": uuid.uuid4(),
            "engagement_id": engagement_id,
            "jurisdiction": jurisdiction,
            "requirement_key": e.requirement_key,
            "element_order": e.order,
            "element_name": e.element_name,
            "status": DraftStatus.pending,
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
) -> DraftResponse:
    if await session.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=404, detail="engagement not found")
    return await _response(session, engagement_id, jurisdiction)


@router.post("/draft-sections/{section_id}/regenerate", response_model=DraftSectionRead)
async def regenerate_section(
    section_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    drafter: Drafter = Depends(get_drafter),
    embedder: Embedder = Depends(get_embedder),
) -> DraftSectionRead:
    section = await session.get(DraftSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="draft section not found")
    element = next(
        (e for e in resolve_requirements(section.jurisdiction) if e.requirement_key == section.requirement_key),
        None,
    )
    if element is None:
        raise HTTPException(status_code=422, detail="requirement not found for section")

    fname_to_docid = await document_filename_map(session, section.engagement_id)
    documents = await retrieve_documents(session, section.engagement_id, embedder, element_query(element))
    notes = await _coverage_notes(session, section.engagement_id, section.jurisdiction)
    await _draft_one(session, section, element, documents,
                     notes.get(section.requirement_key, ""), drafter, fname_to_docid)
    await session.commit()
    await session.refresh(section)
    return _to_read(section)
