import pytest

from app.extraction_schemas import (
    SUPPORTED_SCOPE_LEVELS,
    extraction_plan_for_document_type,
    fact_type_rule,
    load_extraction_schemas,
    schema_keys_for_document_type,
    validate_fact_scope,
    validate_fact_type,
)


V1_SUPPORTED_TYPES = {
    "Service Agreement",
    "Distribution Agreement",
    "Manufacturing Agreement",
    "License Agreement",
    "Loan Agreement",
    "Cost Sharing Agreement",
    "Trial Balance",
    "General Ledger",
    "Invoice Population",
    "Segmented P&L",
    "Registry Extract",
    "Organization Chart",
    "Annual Report",
    "Benchmark Study",
    "Master File",
    "Local File",
}


def test_extraction_registry_covers_v1_supported_document_types():
    registry = load_extraction_schemas()

    assert registry["registry_version"]
    for document_type in V1_SUPPORTED_TYPES:
        assert schema_keys_for_document_type(document_type), document_type


def test_extraction_schema_entries_define_fact_rules_and_scope_levels():
    registry = load_extraction_schemas()

    for schema in registry["schemas"]:
        assert schema["schema_key"]
        assert schema["schema_version"]
        assert schema["supported_document_types"]
        assert schema["fact_types"]
        for fact in schema["fact_types"]:
            assert fact["fact_type"]
            assert fact["value_type"]
            assert fact["allowed_scope_levels"]
            assert set(fact["allowed_scope_levels"]).issubset(SUPPORTED_SCOPE_LEVELS)


def test_unsupported_document_type_resolves_to_skipped_not_supported():
    plan = extraction_plan_for_document_type("Presentation")

    assert plan.status == "skipped_not_supported"
    assert plan.schema_keys == []


def test_invalid_fact_types_are_rejected_by_schema_validation():
    rule = fact_type_rule("agreement_core", "markup")
    assert rule["fact_type"] == "markup"

    validate_fact_type("agreement_core", "markup")
    with pytest.raises(ValueError, match="unsupported fact type"):
        validate_fact_type("agreement_core", "magic_profit_story")


def test_validation_rejects_disallowed_scope_levels():
    validate_fact_scope("financial_table", "revenue", "local_entity")
    validate_fact_scope("financial_table", "revenue", "transaction")

    with pytest.raises(ValueError, match="scope level"):
        validate_fact_scope("financial_table", "revenue", "group")


def test_master_file_and_annual_report_are_group_fact_schemas_only():
    assert schema_keys_for_document_type("Master File") == ["tp_group_document"]
    assert schema_keys_for_document_type("Annual Report") == ["tp_group_document"]
    validate_fact_scope("tp_group_document", "group_business_description", "group")
    validate_fact_scope("tp_group_document", "function", "group")

    with pytest.raises(ValueError, match="unsupported fact type"):
        validate_fact_type("tp_group_document", "local_business_description")
    with pytest.raises(ValueError, match="unsupported fact type"):
        validate_fact_type("tp_group_document", "tested_party")
    with pytest.raises(ValueError, match="unsupported fact type"):
        validate_fact_type("tp_group_document", "benchmark_range")
    with pytest.raises(ValueError, match="scope level"):
        validate_fact_scope("tp_group_document", "function", "local_entity")


def test_benchmark_study_uses_transaction_scope_not_benchmark_scope():
    assert "benchmark" not in SUPPORTED_SCOPE_LEVELS
    assert schema_keys_for_document_type("Benchmark Study") == ["benchmark_study"]

    validate_fact_scope("benchmark_study", "benchmark_range", "transaction")
    with pytest.raises(ValueError, match="scope level"):
        validate_fact_scope("benchmark_study", "benchmark_range", "benchmark")
