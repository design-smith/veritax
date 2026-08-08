from dataclasses import dataclass

from app.extraction_readiness import SETTLED_EXTRACTION_STATUSES, extraction_readiness_for_documents


@dataclass(frozen=True)
class DocState:
    document_id: str
    document_type: str
    classification_state: str
    relevance: str
    extraction_status: str | None
    source_validation_result: dict | None = None
    document_active: bool = True


def test_settled_terminal_statuses_do_not_block_readiness():
    assert {"extracted", "partially_extracted", "failed", "skipped_not_supported", "skipped_out_of_scope"} <= (
        SETTLED_EXTRACTION_STATUSES
    )

    result = extraction_readiness_for_documents(
        [
            DocState("a", "Trial Balance", "accepted", "relevant", "extracted"),
            DocState("b", "General Ledger", "accepted", "relevant", "partially_extracted"),
            DocState("c", "Invoice Population", "accepted", "relevant", "failed"),
        ]
    )

    assert result.ready is True
    assert result.pending_document_ids == []


def test_pending_and_extracting_supported_documents_block_readiness():
    result = extraction_readiness_for_documents(
        [
            DocState("a", "Trial Balance", "accepted", "relevant", "pending"),
            DocState("b", "General Ledger", "accepted", "relevant", "extracting"),
            DocState("c", "Service Agreement", "accepted", "relevant", None),
        ]
    )

    assert result.ready is False
    assert result.pending_document_ids == ["a", "b", "c"]
    assert "3 supported document" in result.blocker


def test_unknown_unsupported_out_of_scope_and_tombstoned_documents_do_not_block_readiness():
    result = extraction_readiness_for_documents(
        [
            DocState("unknown", "Unknown", "unknown", "unknown", None),
            DocState("unsupported", "Presentation", "accepted", "relevant", None),
            DocState("out-of-scope", "Service Agreement", "accepted", "out_of_scope", None),
            DocState("deleted", "Trial Balance", "accepted", "relevant", "pending", document_active=False),
        ]
    )

    assert result.ready is True
    assert result.pending_document_ids == []
