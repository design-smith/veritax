"""Column mapping — saved mappings + a suggestion seam (Class 3 §12-14).

Deterministic detection lives in `financial_intake.detect_columns`. This module adds: (1) saved, versioned
mappings keyed by user + header signature, reused when a repeat upload's headers match (§14); (2) an injectable
suggester seam for AMBIGUOUS columns whose output is a SUGGESTION only — never auto-applied to rows (§13, §74).
The offline/default suggester is deterministic (token overlap); an LLM-backed one is a drop-in via app.state
(mirrors the Class 2 extractor seam) — so "LLM-assisted" stays validated-only and tests stay offline.
"""
from __future__ import annotations

import uuid
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .financial_intake import _norm
from .models import FinancialColumnMapping


class ColumnMappingSuggester(Protocol):
    def suggest(self, headers: list[str], unmapped_fields: list[str]) -> dict[str, str]: ...


# Token hints per canonical field — used to fuzzy-suggest an ambiguous header the deterministic aliases missed.
_FIELD_TOKENS: dict[str, set[str]] = {
    "account_code": {"account", "acct", "gl", "code", "ledger", "nominal"},
    "account_name": {"account", "name", "description", "desc", "narrative", "detail", "label"},
    "amount": {"amount", "balance", "actual", "value", "total", "amt", "closing", "net"},
    "currency": {"currency", "ccy", "curr"},
    "cost_center": {"cost", "center", "centre", "cc"},
    "business_unit": {"business", "unit", "bu", "segment", "division", "department", "dept"},
    "counterparty": {"counterparty", "partner", "intercompany", "ic", "related", "party"},
    "period": {"period", "fiscal", "year", "fy", "month", "quarter", "date"},
}


class KeywordColumnMappingSuggester:
    """Deterministic suggester: the best token-overlap header per unmapped field. Offline, free, no paid API."""

    def suggest(self, headers: list[str], unmapped_fields: list[str]) -> dict[str, str]:
        out: dict[str, str] = {}
        used: set[str] = set()
        for field in unmapped_fields:
            tokens = _FIELD_TOKENS.get(field, set())
            best, best_score = None, 0
            for h in headers:
                if h in used:
                    continue
                score = len(set(_norm(h).split()) & tokens)
                if score > best_score:
                    best, best_score = h, score
            if best is not None:
                out[field] = best
                used.add(best)
        return out


# Offline/default suggester (deterministic). Production may inject an LLM-backed suggester via app.state.
FakeColumnMappingSuggester = KeywordColumnMappingSuggester


async def find_saved_mapping(session: AsyncSession, user_id: uuid.UUID, signature: str) -> dict | None:
    """The latest saved mapping for this user + header signature, or None (§14 reuse)."""
    row = (await session.execute(
        select(FinancialColumnMapping)
        .where(FinancialColumnMapping.user_id == user_id, FinancialColumnMapping.signature == signature)
        .order_by(FinancialColumnMapping.version.desc()).limit(1)
    )).scalar_one_or_none()
    return dict(row.mapping) if row else None


async def save_mapping(session: AsyncSession, user_id: uuid.UUID, signature: str, mapping: dict,
                       label: str | None = None) -> int:
    """Save a new version of the mapping for this user + signature. Returns the new version number."""
    current = (await session.execute(
        select(func.max(FinancialColumnMapping.version))
        .where(FinancialColumnMapping.user_id == user_id, FinancialColumnMapping.signature == signature)
    )).scalar()
    version = int(current or 0) + 1
    session.add(FinancialColumnMapping(
        user_id=user_id, signature=signature, mapping=mapping, label=label, version=version
    ))
    await session.flush()
    return version
