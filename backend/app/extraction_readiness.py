from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .extraction_eligibility import extraction_eligibility

SETTLED_EXTRACTION_STATUSES = {
    "extracted",
    "partially_extracted",
    "failed",
    "skipped_not_supported",
    "skipped_out_of_scope",
}


@dataclass(frozen=True)
class ExtractionReadiness:
    ready: bool
    blocker: str | None
    pending_document_ids: list[str]


def extraction_readiness_for_documents(rows: Iterable[object]) -> ExtractionReadiness:
    pending: list[str] = []
    for row in rows:
        eligibility = extraction_eligibility(
            document_type=str(getattr(row, "document_type", "Unknown") or "Unknown"),
            classification_state=_value(getattr(row, "classification_state", "unknown")),
            relevance=_value(getattr(row, "relevance", "unknown")),
            source_validation_result=getattr(row, "source_validation_result", None) or {},
            document_active=bool(getattr(row, "document_active", True)),
        )
        if eligibility.status != "pending":
            continue
        status = getattr(row, "extraction_status", None)
        if status not in SETTLED_EXTRACTION_STATUSES:
            pending.append(str(getattr(row, "document_id", "?")))
    if pending:
        label = "document is" if len(pending) == 1 else "documents are"
        return ExtractionReadiness(
            ready=False,
            blocker=f"{len(pending)} supported {label} still preparing structured evidence",
            pending_document_ids=pending,
        )
    return ExtractionReadiness(True, None, [])


def _value(value) -> str:
    return str(getattr(value, "value", value))
