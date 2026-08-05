from __future__ import annotations

from types import SimpleNamespace

from app.coverage_readiness import draft_readiness_for_rows
from app.models import CoverageStatus


def _row(
    status: CoverageStatus,
    *,
    conditional: bool = False,
    name: str = "Management structure",
    source: str | None = None,
) -> SimpleNamespace:
    document_id = object() if source and source.lower() != "manual" else None
    evidence = [] if source is None else [SimpleNamespace(source_label=source, document_id=document_id)]
    return SimpleNamespace(status=status, is_conditional=conditional, element_name=name, evidence=evidence)


def test_draft_readiness_blocks_missing_required_support():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present),
        _row(CoverageStatus.missing),
        _row(CoverageStatus.conditional, conditional=True),
    ])

    assert not result.ready
    assert result.blocker == "1 required requirement is missing source support"


def test_draft_readiness_blocks_partial_required_support():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present),
        _row(CoverageStatus.partial),
        _row(CoverageStatus.partial),
    ])

    assert not result.ready
    assert result.blocker == "2 required requirements are only partially supported"


def test_draft_readiness_blocks_partial_rows_even_when_ratio_is_high():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present),
        _row(CoverageStatus.present),
        _row(CoverageStatus.present),
        _row(CoverageStatus.partial),
    ])

    assert not result.ready
    assert result.blocker == "1 required requirement is only partially supported"


def test_draft_readiness_allows_all_required_rows_present():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present),
        _row(CoverageStatus.present),
        _row(CoverageStatus.conditional, conditional=True),
    ])

    assert result.ready
    assert result.blocker is None
    assert result.present_ratio == 1.0


def test_draft_readiness_surfaces_critical_gate_first():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present, name="Management structure"),
        _row(CoverageStatus.partial, name="Method selection"),
    ])

    assert not result.ready
    assert result.blocker == (
        "critical gate blocked: method/tested-party analysis is partial; "
        "mark it satisfied or add source support before drafting"
    )


def test_draft_readiness_allows_manual_satisfied_critical_gate():
    # A user marking a critical requirement satisfied (Manual evidence, no document) counts toward
    # readiness — the user is asserting the requirement is supplied, so drafting can proceed.
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present, name="Method selection", source="Manual"),
    ])

    assert result.ready
    assert result.blocker is None


def test_draft_readiness_allows_critical_gate_with_source_evidence():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present, name="Method selection", source="benchmark-study.pdf"),
    ])

    assert result.ready
