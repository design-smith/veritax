"""Account classification (Class 3 §19).

Classify each financial row as operating / non_operating / exceptional / financing / tax / unallocated /
review_required. Deterministic-first from account code + name; an injectable suggester proposes a class for
AMBIGUOUS accounts (validated-only, never auto-applied — mirrors the S3 mapping-suggester seam). No universal TP
treatment is hard-coded (§19): the label is advisory; the actual exclusion/allocation happens in S6/S7.
"""
from __future__ import annotations

from typing import Protocol

CLASSIFICATIONS = (
    "operating", "non_operating", "exceptional", "financing", "tax", "unallocated", "review_required",
)

# Specific signals first, then the broad operating set; first match wins.
_RULES: list[tuple[tuple[str, ...], str]] = [
    (("income tax", "corporation tax", "deferred tax", "current tax", "withholding tax", " tax "), "tax"),
    (("interest expense", "interest income", "finance cost", "finance charge", "finance income",
      " loan", "borrowing", "overdraft", "debt interest"), "financing"),
    (("impairment", "restructuring", "exceptional", "one-off", "one off", "write-off", "write off",
      "onerous", "disposal of", "loss on disposal", "gain on disposal"), "exceptional"),
    (("dividend", "fx gain", "fx loss", "foreign exchange gain", "foreign exchange loss",
      "gain on investment", "investment income", "fair value", "non-operating", "other income"), "non_operating"),
    (("revenue", "sales", "turnover", "cost of sales", "cost of goods", "cogs", "salar", "wages", "payroll",
      "rent", "depreciation", "amortis", "amortiz", "marketing", "advertis", "office", "utilities", "purchases",
      "materials", "freight", "carriage", "commission", "travel", "insurance", "maintenance", "professional fee",
      "consulting", "subcontract", "services", "staff", "admin"), "operating"),
]


def classify_account(account_code: str | None, account_name: str | None) -> tuple[str, str]:
    """Return (classification, source). source ∈ {'deterministic','default'}. Padded so ' tax ' matches 'Tax'."""
    text = f" {account_code or ''} {account_name or ''} ".lower()
    if not text.strip():
        return ("unallocated", "default")     # no account information at all
    for keywords, cls in _RULES:
        if any(k in text for k in keywords):
            return (cls, "deterministic")
    return ("review_required", "default")      # named but not confidently classified → needs review


class ClassificationSuggester(Protocol):
    def suggest(self, account_code: str | None, account_name: str | None) -> str | None: ...


class KeywordClassificationSuggester:
    """Deterministic offline suggester for ambiguous accounts. Weak priors the practitioner confirms; never
    auto-applied. An LLM-backed suggester is a drop-in via app.state (mirrors the S3 mapping suggester)."""

    def suggest(self, account_code: str | None, account_name: str | None) -> str | None:
        cls, source = classify_account(account_code, account_name)
        if source == "deterministic":
            return cls
        text = f" {account_code or ''} {account_name or ''} ".lower()
        if "income" in text or "gain" in text:
            return "non_operating"
        if "expense" in text or "cost" in text or "fee" in text or "charge" in text:
            return "operating"
        return "operating" if text.strip() else None


FakeClassificationSuggester = KeywordClassificationSuggester
