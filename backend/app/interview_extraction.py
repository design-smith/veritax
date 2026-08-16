"""Interview responses → candidate functional facts (Class 2 §4-5, §45-46).

Deterministic-first (§45): a keyword extractor classifies a response into a controlled far_type; an LLM extractor
can slot in behind the same Protocol later. The deterministic §46 gate (functional_fact_ok + grounded text) runs
regardless, so no unsupported functional statement is ever promoted. Facts ride the S2 pipeline with
interview-response provenance (document_id null; §19).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .canonicalization import promote_canonical_facts
from .extraction_store import (
    ExtractedFactInput,
    FactSourceInput,
    RunInput,
    add_extracted_fact,
    create_extraction_run,
)
from .functional import functional_fact_ok
from .models import FunctionalInterview, InterviewQuestion

_FUNCTIONAL_SCHEMA_VERSION = "2026-08-16"


@dataclass(frozen=True)
class FunctionalCandidate:
    fact_type: str          # function_performed | asset_used | risk_assumed | risk_controlled | capability
    far_type: str
    value: bool = True


class InterviewExtractor(Protocol):
    def extract(self, question_text: str, response_text: str) -> list[FunctionalCandidate]: ...


# Controlled keyword → (fact_type, far_type) over the FAR ontology; deterministic, order-stable.
_KEYWORDS: list[tuple[tuple[str, ...], str, str]] = [
    (("hedg", "currency", "foreign exchange", " fx "), "risk_controlled", "foreign_exchange_risk"),
    (("credit risk", "creditworth", "bad debt"), "risk_assumed", "credit_risk"),
    (("inventory", "obsolescen", "stock"), "risk_assumed", "inventory_risk"),
    (("supply chain", "supplier"), "risk_assumed", "supply_chain_risk"),
    (("warranty",), "risk_assumed", "warranty_risk"),
    (("customer", "sales", "negotiat"), "function_performed", "sales"),
    (("marketing", "campaign", "brand"), "function_performed", "marketing"),
    (("manufactur", "production", "assembl"), "function_performed", "manufacturing"),
    (("distribut",), "function_performed", "distribution"),
    (("pricing", "price"), "function_performed", "pricing"),
    (("research", "r&d", "development"), "function_performed", "research"),
    (("treasury", "funding", "cash management"), "function_performed", "cash_management"),
    (("patent", "trademark", "intellectual property", " ip "), "asset_used", "patents"),
]


class KeywordInterviewExtractor:
    """Deterministic v1 extractor: maps controlled keywords in the question+response to ontology far_types."""

    def extract(self, question_text: str, response_text: str) -> list[FunctionalCandidate]:
        text = f" {question_text} {response_text} ".lower()
        out: list[FunctionalCandidate] = []
        seen: set[tuple[str, str]] = set()
        for keywords, fact_type, far_type in _KEYWORDS:
            if any(k in text for k in keywords) and (fact_type, far_type) not in seen:
                seen.add((fact_type, far_type))
                out.append(FunctionalCandidate(fact_type, far_type, True))
        return out


# The test/offline default is the deterministic extractor itself (no paid API).
FakeInterviewExtractor = KeywordInterviewExtractor


async def run_interview_extraction(session: AsyncSession, extractor: InterviewExtractor,
                                   interview_id: uuid.UUID, *, evidence_type: str = "functional_interview") -> int:
    """Extract §46-validated functional facts from an interview's responses and promote them. Returns facts added.

    `evidence_type` labels the provenance kind (functional_interview | questionnaire) — questionnaires (S6) reuse
    this exact path so their answers enter the SAME functional model (§21), not a separate silo."""
    interview = (
        await session.execute(
            select(FunctionalInterview).where(FunctionalInterview.id == interview_id)
            .options(selectinload(FunctionalInterview.questions).selectinload(InterviewQuestion.responses))
        )
    ).scalar_one_or_none()
    if interview is None:
        return 0
    transaction_id = interview.transaction_ids[0] if interview.transaction_ids else None

    run = await create_extraction_run(session, RunInput(
        engagement_id=interview.engagement_id, document_id=None, schema_key="functional",
        schema_version=_FUNCTIONAL_SCHEMA_VERSION, classification_type="Functional Interview",
        classification_version="interview", runner_version="interview-extractor-v1", model_version="keyword-v1",
        fingerprint=f"iv-{interview_id.hex[:16]}-{uuid.uuid4().hex[:12]}", status="extracted", active=True))

    created = 0
    for question in interview.questions:
        for response in question.responses:
            if not response.response_raw.strip():
                continue
            for cand in extractor.extract(question.question_text, response.response_raw):
                if not functional_fact_ok(cand.fact_type, cand.far_type):   # §46 deterministic gate
                    continue
                await add_extracted_fact(
                    session, run.id, None,
                    ExtractedFactInput(
                        schema_key="functional", schema_version=_FUNCTIONAL_SCHEMA_VERSION,
                        fact_type=cand.fact_type, value_raw=response.response_raw[:500],
                        value_normalized=str(cand.value).lower(), value_type="boolean", scope_level="local_entity",
                        far_type=cand.far_type, transaction_id=transaction_id, evidence_type=evidence_type,
                        interview_response_id=response.id),
                    sources=[FactSourceInput(document_id=None, interview_response_id=response.id,
                                             locator=question.question_key, quote=response.response_raw)],
                )
                created += 1
    await session.flush()
    await promote_canonical_facts(session, interview.engagement_id)
    return created
