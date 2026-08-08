from app.extraction_eligibility import extraction_eligibility


def test_relevant_supported_document_is_eligible():
    result = extraction_eligibility(
        document_type="Service Agreement",
        classification_state="accepted",
        relevance="relevant",
        source_validation_result={"entity": "pass", "jurisdiction": "pass", "fiscal_year": "pass"},
    )

    assert result.status == "pending"
    assert result.schema_keys == ["agreement_core"]
    assert result.scope_warnings == []


def test_partially_relevant_supported_document_is_eligible_with_scope_warnings():
    result = extraction_eligibility(
        document_type="Trial Balance",
        classification_state="accepted",
        relevance="partially_relevant",
        source_validation_result={"entity": "pass", "jurisdiction": "unknown", "fiscal_year": "warning"},
    )

    assert result.status == "pending"
    assert result.schema_keys == ["financial_table"]
    assert result.scope_warnings == ["jurisdiction: unknown", "fiscal_year: warning"]


def test_unknown_document_is_skipped_for_structured_extraction():
    result = extraction_eligibility(
        document_type="Unknown",
        classification_state="unknown",
        relevance="unknown",
        source_validation_result={},
    )

    assert result.status == "skipped_unknown"
    assert result.schema_keys == []


def test_out_of_scope_document_is_skipped_for_structured_extraction():
    result = extraction_eligibility(
        document_type="Service Agreement",
        classification_state="accepted",
        relevance="out_of_scope",
        source_validation_result={"entity": "fail"},
    )

    assert result.status == "skipped_out_of_scope"
    assert result.schema_keys == []


def test_unsupported_document_type_is_skipped_not_failed():
    result = extraction_eligibility(
        document_type="Presentation",
        classification_state="accepted",
        relevance="relevant",
        source_validation_result={"entity": "pass"},
    )

    assert result.status == "skipped_not_supported"
    assert result.schema_keys == []


def test_tombstoned_document_is_skipped():
    result = extraction_eligibility(
        document_type="Service Agreement",
        classification_state="accepted",
        relevance="relevant",
        source_validation_result={"entity": "pass"},
        document_active=False,
    )

    assert result.status == "skipped_deleted"
    assert result.schema_keys == []
