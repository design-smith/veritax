"""Pure-logic checks for batched assessment (no DB / network).

Covers the pieces the batching + cross-jurisdiction dedup depend on: chunk union/dedup, the tolerant
batch-payload parser, and the Fake assessor's batch contract. The DB-level dedup (twin copy across
jurisdictions) is exercised by the live NL→Germany verification, which needs a real pgvector Postgres.
"""

from app.assessment import FakeAssessor, _assessments_from
from app.corpus import DocContext, union_docs
from app.requirements import resolve_requirements

SEP = "\n…\n"


def test_union_docs_dedups_overlapping_chunks_and_keeps_order():
    a = DocContext("s", "d1", "financials", "f.txt", f"A{SEP}B")
    b = DocContext("s", "d1", "financials", "f.txt", f"B{SEP}C")  # B overlaps a
    c = DocContext("s", "d2", "interview", "i.txt", "X")
    u = union_docs([[a], [b, c]])
    assert [x.document_id for x in u] == ["d1", "d2"]  # first-seen order
    d1 = next(x for x in u if x.document_id == "d1")
    assert d1.text.split(SEP) == ["A", "B", "C"]  # B appears once


def test_assessments_from_skips_garbled_and_keeps_valid():
    payload = {
        "assessments": [
            {"element_number": 1, "status": "present",
             "evidence": [{"source_filename": "f.txt", "locator": "p1"}], "confidence": "high"},
            {"element_number": 2, "status": "bogus"},   # off-enum status → skipped
            {"status": "present"},                       # no element_number → skipped
            {"element_number": 3, "status": "missing", "evidence": []},
        ]
    }
    m = _assessments_from(payload)
    assert set(m) == {1, 3}
    assert m[1].evidence[0].source_filename == "f.txt"
    assert m[3].status == "missing"


def test_fake_assess_batch_returns_one_verdict_per_element_keyed_1based():
    els = list(resolve_requirements("Netherlands"))[:4]
    docs = [DocContext("s", "d1", "interview", "i.txt", "royalty distributor functions risks")]
    res = FakeAssessor().assess_batch(els, docs)
    assert set(res) == {1, 2, 3, 4}
    assert all(hasattr(v, "status") for v in res.values())
