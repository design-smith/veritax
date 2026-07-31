"""Drafter structured output + validation (pure, no DB)."""

import pytest

from app.corpus import DocContext
from app.drafting import WRITE_SECTION_TOOL, WRITE_SECTIONS_TOOL, _draft_result_from, _draft_results_from
from app.routers.draft import _validate_draft_result


DOCS = [DocContext("s1", "d1", "interview", "fin.pdf", "Revenue was 42.0 in 2024 and margin was 3.1 percent.")]
FNAME = {"fin.pdf": "00000000-0000-0000-0000-000000000001"}


def test_draft_result_parses_tables_and_charts():
    payload = {
        "content": "Revenue in [[table:t1]], margin in [[chart:c1]].[1]",
        "citations": [{"marker": 1, "kind": "document", "source_label": "fin.pdf", "quote": "…"}],
        "tables": [{"id": "t1", "columns": ["Year", "Rev"], "rows": [["2024", "42.0"]]}],
        "charts": [{"id": "c1", "type": "bar", "title": "Margin", "categories": ["2024"], "series": [{"name": "m", "values": [3.1]}]}],
    }
    r = _draft_result_from(payload)
    assert r.content.startswith("Revenue")
    assert r.tables[0]["id"] == "t1"
    assert r.charts[0]["type"] == "bar"
    assert len(r.citations) == 1


def test_draft_result_defaults_empty_when_absent():
    r = _draft_result_from({"content": "Just prose.", "citations": []})
    assert r.tables == [] and r.charts == []


def test_batch_carries_tables_charts():
    payload = {"sections": [{
        "section_number": 1, "content": "x [[chart:c1]]", "citations": [],
        "tables": [], "charts": [{"id": "c1", "type": "pie", "title": "t", "categories": ["a"], "series": [{"name": "s", "values": [1]}]}],
    }]}
    out = _draft_results_from(payload)
    assert out[1].charts[0]["id"] == "c1"


def test_tool_schema_exposes_tables_and_charts():
    props = WRITE_SECTION_TOOL["input_schema"]["properties"]
    assert "tables" in props and "charts" in props
    assert "tables" in WRITE_SECTIONS_TOOL["input_schema"]["properties"]["sections"]["items"]["properties"]


def test_draft_validation_accepts_grounded_citations_and_objects():
    result = _draft_result_from({
        "content": "Revenue is summarised in [[table:t1]].[1]",
        "citations": [{"marker": 1, "kind": "document", "source_label": "fin.pdf", "quote": "Revenue was 42.0 in 2024"}],
        "tables": [{"id": "t1", "columns": ["Year", "Revenue"], "rows": [["2024", "42.0"]]}],
    })
    _validate_draft_result(result, DOCS, FNAME)


def test_draft_validation_rejects_ungrounded_output():
    result = _draft_result_from({
        "content": "Revenue is 99.0.[1]",
        "citations": [{"marker": 1, "kind": "document", "source_label": "fin.pdf", "quote": "Revenue was 99.0 in 2024"}],
    })
    with pytest.raises(RuntimeError, match="quote was not found"):
        _validate_draft_result(result, DOCS, FNAME)


def test_draft_validation_rejects_uncited_factual_sentence():
    result = _draft_result_from({
        "content": "Revenue was stable.[1] Margin improved without a citation.",
        "citations": [{"marker": 1, "kind": "document", "source_label": "fin.pdf", "quote": "Revenue was 42.0 in 2024"}],
    })
    with pytest.raises(RuntimeError, match="lacks inline citation"):
        _validate_draft_result(result, DOCS, FNAME)


def test_draft_validation_rejects_number_not_in_cited_quote():
    result = _draft_result_from({
        "content": "Revenue was 99.0 in 2024.[1]",
        "citations": [{"marker": 1, "kind": "document", "source_label": "fin.pdf", "quote": "Revenue was 42.0 in 2024"}],
    })
    with pytest.raises(RuntimeError, match="not present in the cited quote"):
        _validate_draft_result(result, DOCS, FNAME)


def test_draft_validation_rejects_missing_citation_marker_record():
    result = _draft_result_from({
        "content": "Revenue is 42.0.[1]",
        "citations": [],
    })
    with pytest.raises(RuntimeError, match="no citations"):
        _validate_draft_result(result, DOCS, FNAME)
