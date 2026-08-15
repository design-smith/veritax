"""Pydantic models for the regulatory registry — validate the version-controlled JSON on load (PRD §5-§8)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

VerificationStatus = Literal["verified", "needs_review", "superseded", "conflicting_source", "deprecated"]


class RegulatorySource(BaseModel):
    """Authoritative provenance for a rule (PRD §7). Primary (tax authority/statute) outranks secondary."""
    source_id: str
    title: str
    issuing_authority: str
    source_type: str                    # statute | regulation | guidance | faq | oecd | secondary
    jurisdiction: str
    publication_date: str | None = None
    effective_date: str | None = None
    url: str | None = None
    retrieved_at: str | None = None
    citation_locator: str | None = None
    language: str = "en"
    status: str = "active"


class RegulatoryRule(BaseModel):
    """One machine-readable rule (PRD §6). `conditions` is the AND/OR/NOT tree evaluated by engine.evaluate;
    `None` means unconditional. `effective_from`/`effective_to` drive fiscal-year version selection (PRD §9)."""
    rule_key: str
    rule_category: str                  # applicability | threshold | filing | transaction | benchmarking | ...
    rule_type: str | None = None
    version: int = 1
    effective_from: str                 # ISO date "YYYY-MM-DD"
    effective_to: str | None = None     # None = still in force
    conditions: dict[str, Any] | None = None
    result: Any = None
    plain_english: str = ""
    source_ids: list[str] = []
    verification_status: VerificationStatus = "needs_review"
    supersedes_rule_id: str | None = None


class JurisdictionProfile(BaseModel):
    """A jurisdiction's regulatory profile as stored in jurisdictions/<CC>/<year>.json."""
    jurisdiction: str                   # ISO country code, e.g. "QA"
    name: str
    status: str = "active"
    sources: list[RegulatorySource] = []
    rules: list[RegulatoryRule] = []
