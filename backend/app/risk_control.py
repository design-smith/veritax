"""Risk control & capability (Class 2 §11-12, §40).

Deterministic status: a risk is a `potential_mismatch` when the entity that contractually bears it diverges from
the entity that actually controls it or has the capability to (Jayesh's point — a contract can't put risk where
there's no capability to manage it); `aligned` when they coincide; `undetermined` when the bearer or the
control/capability is unknown. Conflicts are preserved, never auto-resolved (§32). No LLM.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import RiskControlProfile


def compute_status(contractual_bearer: str | None, control: str | None, capability: str | None) -> str:
    if contractual_bearer is None or (control is None and capability is None):
        return "undetermined"
    if (control is not None and control != contractual_bearer) or \
       (capability is not None and capability != contractual_bearer):
        return "potential_mismatch"
    return "aligned"


async def upsert_risk_control(
    session: AsyncSession, engagement_id: uuid.UUID, *, transaction_id: str | None, risk_type: str,
    contractual_bearer_entity_id: str | None = None, exposed_entity_id: str | None = None,
    decision_maker_entity_id: str | None = None, control_entity_id: str | None = None,
    capability_entity_id: str | None = None, financial_capacity_entity_id: str | None = None,
) -> RiskControlProfile:
    """Create/update the (transaction, risk) control record and (re)compute its deterministic status."""
    status = compute_status(contractual_bearer_entity_id, control_entity_id, capability_entity_id)
    row = (
        await session.execute(
            select(RiskControlProfile).where(
                RiskControlProfile.engagement_id == engagement_id,
                RiskControlProfile.transaction_id == transaction_id,
                RiskControlProfile.risk_type == risk_type,
            )
        )
    ).scalar_one_or_none()
    values = dict(
        contractual_bearer_entity_id=contractual_bearer_entity_id, exposed_entity_id=exposed_entity_id,
        decision_maker_entity_id=decision_maker_entity_id, control_entity_id=control_entity_id,
        capability_entity_id=capability_entity_id, financial_capacity_entity_id=financial_capacity_entity_id,
        status=status,
    )
    if row is None:
        row = RiskControlProfile(engagement_id=engagement_id, transaction_id=transaction_id, risk_type=risk_type, **values)
        session.add(row)
    else:
        for k, v in values.items():
            setattr(row, k, v)
    await session.flush()
    return row
