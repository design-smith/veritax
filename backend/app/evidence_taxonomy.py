from __future__ import annotations

import json
from functools import lru_cache
from importlib.resources import files
from typing import Any


@lru_cache(maxsize=1)
def load_taxonomy() -> dict[str, Any]:
    data = files("app.data").joinpath("evidence_taxonomy.json").read_text(encoding="utf-8")
    taxonomy = json.loads(data)
    names = document_type_names(taxonomy)
    if len(names) != len(set(names)):
        raise ValueError("evidence taxonomy contains duplicate document types")
    if "Unknown" not in names:
        raise ValueError("evidence taxonomy must include Unknown")
    return taxonomy


def document_type_names(taxonomy: dict[str, Any] | None = None) -> list[str]:
    source = taxonomy or load_taxonomy()
    return [str(entry["document_type"]) for entry in source.get("document_types", [])]


def document_type_entry(document_type: str, taxonomy: dict[str, Any] | None = None) -> dict[str, Any]:
    source = taxonomy or load_taxonomy()
    for entry in source.get("document_types", []):
        if entry.get("document_type") == document_type:
            return entry
    raise ValueError(f"unsupported document type: {document_type}")


def require_document_type(document_type: str) -> str:
    document_type_entry(document_type)
    return document_type
