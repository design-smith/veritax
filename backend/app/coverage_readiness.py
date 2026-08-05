from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .evidence_quality import critical_quality_label
from .models import CoverageStatus


DRAFT_MIN_PRESENT_RATIO = 1.00


@dataclass(frozen=True)
class DraftReadiness:
    ready: bool
    blocker: str | None
    present_ratio: float
    min_present_ratio: float = DRAFT_MIN_PRESENT_RATIO


def _plural(n: int, singular: str, plural: str) -> str:
    return singular if n == 1 else plural


def draft_readiness_from_counts(
    *,
    required_total: int,
    present: int,
    partial: int,
    missing: int,
    pending: int,
    failed: int,
) -> DraftReadiness:
    present_ratio = present / required_total if required_total > 0 else 0.0
    if required_total <= 0:
        return DraftReadiness(False, "requirements have not been assessed", present_ratio)
    if pending > 0:
        return DraftReadiness(False, "requirements still assessing", present_ratio)
    if failed > 0:
        return DraftReadiness(False, "requirements have failed rows", present_ratio)
    if missing > 0:
        label = _plural(missing, "requirement is", "requirements are")
        return DraftReadiness(False, f"{missing} required {label} missing source support", present_ratio)
    if partial > 0:
        label = _plural(partial, "requirement is", "requirements are")
        return DraftReadiness(False, f"{partial} required {label} only partially supported", present_ratio)
    if present_ratio < DRAFT_MIN_PRESENT_RATIO:
        pct = round(present_ratio * 100)
        threshold = round(DRAFT_MIN_PRESENT_RATIO * 100)
        return DraftReadiness(
            False,
            f"only {pct}% of required requirements are fully supported; add source material until at least {threshold}% are present",
            present_ratio,
        )
    return DraftReadiness(True, None, present_ratio)


def draft_readiness_for_rows(rows: Iterable[object]) -> DraftReadiness:
    required = [r for r in rows if not getattr(r, "is_conditional", False)]
    # Critical elements must be present — either assessed present, or explicitly marked satisfied by the
    # user. A manual "mark satisfied" is the user asserting the requirement is supplied, so it counts
    # toward readiness (we don't additionally demand document-backed evidence on top of present).
    for row in required:
        label = critical_quality_label(str(getattr(row, "element_name", "")))
        if label and getattr(row, "status", None) != CoverageStatus.present:
            status = getattr(row, "status", None)
            status_value = getattr(status, "value", status) or "unassessed"
            return DraftReadiness(
                False,
                f"critical gate blocked: {label} is {status_value}; mark it satisfied or add source support before drafting",
                sum(1 for r in required if getattr(r, "status", None) == CoverageStatus.present) / len(required)
                if required else 0.0,
            )
    return draft_readiness_from_counts(
        required_total=len(required),
        present=sum(1 for r in required if getattr(r, "status", None) == CoverageStatus.present),
        partial=sum(1 for r in required if getattr(r, "status", None) == CoverageStatus.partial),
        missing=sum(1 for r in required if getattr(r, "status", None) == CoverageStatus.missing),
        pending=sum(1 for r in required if getattr(r, "status", None) == CoverageStatus.pending),
        failed=sum(1 for r in required if getattr(r, "status", None) == CoverageStatus.failed),
    )
