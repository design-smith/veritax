"""Functional interview workflow (Class 2 §13-19, §37). An active Planning capability: create a scoped
interview, auto-generate role/transaction-appropriate questions from controlled modules, capture answers
(raw response immutable, §18), and read back a simple findings view. Extraction of facts is S5."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import AuthUser
from ..deps import assert_owner, get_current_user, get_session, require_engagement_owner
from ..functional import select_questions
from ..models import Engagement, FunctionalInterview, InterviewQuestion, InterviewResponse
from ..schemas import (
    InterviewCreate,
    InterviewFindings,
    InterviewListItem,
    InterviewRead,
    InterviewResponseRead,
    ResponseCreate,
)

router = APIRouter(tags=["interviews"])


async def _load(session: AsyncSession, interview_id: uuid.UUID) -> FunctionalInterview:
    interview = (
        await session.execute(
            select(FunctionalInterview)
            .where(FunctionalInterview.id == interview_id)
            .options(selectinload(FunctionalInterview.questions).selectinload(InterviewQuestion.responses))
        )
    ).scalar_one_or_none()
    if interview is None:
        raise HTTPException(status_code=404, detail="interview not found")
    return interview


@router.post("/engagements/{engagement_id}/interviews", response_model=InterviewRead, status_code=201)
async def create_interview(
    engagement_id: uuid.UUID,
    body: InterviewCreate,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> InterviewRead:
    interview = FunctionalInterview(
        engagement_id=engagement_id, entity_id=body.entity_id, participant_name=body.participant_name,
        participant_title=body.participant_title, participant_role=body.participant_role,
        transaction_ids=body.transaction_ids, fiscal_period=body.fiscal_period,
        interview_date=body.interview_date, status="not_started",
    )
    session.add(interview)
    await session.flush()
    for q in select_questions(body.participant_role, tuple(body.transaction_types)):
        session.add(InterviewQuestion(
            interview_id=interview.id, question_key=q["question_key"], question_text=q["question_text"],
            question_category=q["question_category"], sequence=q["sequence"]))
    await session.commit()
    return InterviewRead.model_validate(await _load(session, interview.id))


@router.get("/engagements/{engagement_id}/interviews", response_model=list[InterviewListItem])
async def list_interviews(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> list[InterviewListItem]:
    interviews = (
        await session.execute(
            select(FunctionalInterview)
            .where(FunctionalInterview.engagement_id == engagement_id)
            .order_by(FunctionalInterview.created_at)
            .options(selectinload(FunctionalInterview.questions).selectinload(InterviewQuestion.responses))
        )
    ).scalars().all()
    return [
        InterviewListItem(
            id=i.id, participant_name=i.participant_name, participant_role=i.participant_role,
            entity_id=i.entity_id, transaction_ids=i.transaction_ids, status=i.status,
            interview_date=i.interview_date, question_count=len(i.questions),
            answered_count=sum(1 for q in i.questions if q.responses),
        )
        for i in interviews
    ]


@router.get("/interviews/{interview_id}", response_model=InterviewRead)
async def get_interview(
    interview_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> InterviewRead:
    interview = await _load(session, interview_id)
    await assert_owner(session, interview.engagement_id, user)
    return InterviewRead.model_validate(interview)


@router.post("/interviews/{interview_id}/responses", response_model=InterviewResponseRead, status_code=201)
async def add_response(
    interview_id: uuid.UUID,
    body: ResponseCreate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> InterviewResponseRead:
    interview = await _load(session, interview_id)
    await assert_owner(session, interview.engagement_id, user)
    question = await session.get(InterviewQuestion, body.question_id)
    if question is None or question.interview_id != interview_id:
        raise HTTPException(status_code=404, detail="question not found for this interview")
    resp = InterviewResponse(question_id=body.question_id, response_raw=body.response_raw,
                             response_summary=body.response_summary, locator=body.locator)
    session.add(resp)
    if interview.status == "not_started":
        interview.status = "in_progress"
    await session.commit()
    await session.refresh(resp)
    return InterviewResponseRead.model_validate(resp)


@router.get("/interviews/{interview_id}/findings", response_model=InterviewFindings)
async def interview_findings(
    interview_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> InterviewFindings:
    interview = await _load(session, interview_id)
    await assert_owner(session, interview.engagement_id, user)
    # v1 (§37): a simple deterministic roll-up — answered questions grouped by category; unanswered = open.
    findings = InterviewFindings()
    bucket = {"functions": findings.functions, "risks": findings.risks, "decision_making": findings.decision_makers}
    for q in interview.questions:
        if not q.responses:
            findings.open_questions.append(q.question_text)
        elif q.question_category in bucket:
            bucket[q.question_category].append(q.question_text)
    return findings
