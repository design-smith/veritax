import pytest

from app.evidence_taxonomy import document_type_names, load_taxonomy, require_document_type


def test_taxonomy_contains_prd_document_types():
    taxonomy = load_taxonomy()
    names = document_type_names(taxonomy)

    assert taxonomy["taxonomy_version"]
    assert "Service Agreement" in names
    assert "Annual Report" in names
    assert "Trial Balance" in names
    assert "Benchmark Study" in names
    assert "Unknown" in names


def test_taxonomy_rejects_invented_document_types():
    require_document_type("Annual Report")
    with pytest.raises(ValueError, match="unsupported document type"):
        require_document_type("Magic Tax Memo")
