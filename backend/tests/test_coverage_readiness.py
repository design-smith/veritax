from __future__ import annotations

from types import SimpleNamespace

from app.coverage_readiness import draft_readiness_for_rows
from app.models import CoverageStatus


def _row(status: CoverageStatus, *, conditional: bool = False) -> SimpleNamespace:
    return SimpleNamespace(status=status, is_conditional=conditional)


def test_draft_readiness_blocks_missing_required_support():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present),
        _row(CoverageStatus.missing),
        _row(CoverageStatus.conditional, conditional=True),
    ])

    assert not result.ready
    assert result.blocker == "1 required requirement is missing source support"


def test_draft_readiness_blocks_when_present_ratio_is_too_low():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present),
        _row(CoverageStatus.partial),
        _row(CoverageStatus.partial),
    ])

    assert not result.ready
    assert result.blocker is not None
    assert "only 33%" in result.blocker


def test_draft_readiness_allows_strong_file_with_partial_rows():
    result = draft_readiness_for_rows([
        _row(CoverageStatus.present),
        _row(CoverageStatus.present),
        _row(CoverageStatus.present),
        _row(CoverageStatus.partial),
    ])

    assert result.ready
    assert result.blocker is None
