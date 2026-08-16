"""S3: the functional-interview data model — interview → question → response provenance chain (§18-19, §43)."""
import uuid

from sqlalchemy import select

from app.main import app
from app.models import FunctionalInterview, InterviewQuestion, InterviewResponse


async def _engagement(client) -> uuid.UUID:
    return uuid.UUID((await client.post("/engagements")).json()["id"])


async def test_interview_question_response_chain_and_provenance(client):
    engagement_id = await _engagement(client)
    async with app.state.session_factory() as session:
        interview = FunctionalInterview(
            engagement_id=engagement_id, participant_name="Jane Roe", participant_title="Finance Director",
            participant_role="finance", transaction_ids=["txn_1"], fiscal_period="FY2026", status="in_progress")
        session.add(interview)
        await session.flush()
        q = InterviewQuestion(interview_id=interview.id, question_key="services.fee_approval",
                              question_text="Who approves the service fee?", question_category="finance", sequence=1)
        session.add(q)
        await session.flush()
        r = InterviewResponse(question_id=q.id, response_raw="The Swiss principal approves all service fees.",
                              response_summary="Fee approval sits with the Swiss principal.", locator="Q1")
        session.add(r)
        await session.commit()
        interview_id, response_id = interview.id, r.id

    # response → question → interview → participant, all traceable.
    async with app.state.session_factory() as session:
        resp = await session.get(InterviewResponse, response_id)
        assert resp.response_raw.startswith("The Swiss principal")   # raw answer preserved (§18)
        ques = await session.get(InterviewQuestion, resp.question_id)
        intv = await session.get(FunctionalInterview, ques.interview_id)
        assert intv.id == interview_id and intv.participant_role == "finance" and intv.transaction_ids == ["txn_1"]
        loaded = (await session.execute(
            select(FunctionalInterview).where(FunctionalInterview.id == interview_id))).scalar_one()
        assert loaded.questions[0].responses[0].id == response_id   # relationship chain loads


async def test_follow_up_question_links_to_parent(client):
    engagement_id = await _engagement(client)
    async with app.state.session_factory() as session:
        interview = FunctionalInterview(engagement_id=engagement_id, participant_name="X", status="not_started")
        session.add(interview)
        await session.flush()
        q = InterviewQuestion(interview_id=interview.id, question_key="pricing.approval",
                              question_text="Who approves customer pricing?", sequence=1)
        session.add(q)
        await session.flush()
        follow = InterviewQuestion(interview_id=interview.id, question_key="pricing.local_authority",
                                   question_text="Can the local entity deviate from Swiss pricing?",
                                   sequence=2, parent_question_id=q.id)   # §17 adaptive follow-up
        session.add(follow)
        await session.commit()
        follow_id, parent_id = follow.id, q.id
    async with app.state.session_factory() as session:
        assert (await session.get(InterviewQuestion, follow_id)).parent_question_id == parent_id


async def test_completion_states(client):
    engagement_id = await _engagement(client)
    async with app.state.session_factory() as session:
        for st in ("not_started", "in_progress", "completed", "completed_with_gaps"):
            session.add(FunctionalInterview(engagement_id=engagement_id, participant_name="P", status=st))
        await session.commit()
        rows = (await session.execute(
            select(FunctionalInterview).where(FunctionalInterview.engagement_id == engagement_id))).scalars().all()
    assert {r.status for r in rows} == {"not_started", "in_progress", "completed", "completed_with_gaps"}
