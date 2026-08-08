from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files
from typing import Any


SUPPORTED_SCOPE_LEVELS = {"group", "local_entity", "transaction", "counterparty", "unknown"}


@dataclass(frozen=True)
class ExtractionPlan:
    status: str
    schema_keys: list[str]


@lru_cache(maxsize=1)
def load_extraction_schemas() -> dict[str, Any]:
    data = files("app.data").joinpath("extraction_schemas.json").read_text(encoding="utf-8")
    registry = json.loads(data)
    keys = [str(schema["schema_key"]) for schema in registry.get("schemas", [])]
    if not registry.get("registry_version"):
        raise ValueError("extraction schema registry must include registry_version")
    if len(keys) != len(set(keys)):
        raise ValueError("extraction schema registry contains duplicate schema keys")
    for schema in registry.get("schemas", []):
        if not schema.get("schema_version"):
            raise ValueError(f"extraction schema {schema.get('schema_key')} missing schema_version")
        if not schema.get("supported_document_types"):
            raise ValueError(f"extraction schema {schema.get('schema_key')} missing supported document types")
        for fact in schema.get("fact_types", []):
            levels = set(fact.get("allowed_scope_levels", []))
            if not levels or not levels.issubset(SUPPORTED_SCOPE_LEVELS):
                raise ValueError(f"invalid scope levels for fact type {fact.get('fact_type')}")
    return registry


def schema_entry(schema_key: str, registry: dict[str, Any] | None = None) -> dict[str, Any]:
    source = registry or load_extraction_schemas()
    for schema in source.get("schemas", []):
        if schema.get("schema_key") == schema_key:
            return schema
    raise ValueError(f"unsupported extraction schema: {schema_key}")


def schema_keys_for_document_type(document_type: str, registry: dict[str, Any] | None = None) -> list[str]:
    source = registry or load_extraction_schemas()
    return [
        str(schema["schema_key"])
        for schema in source.get("schemas", [])
        if document_type in schema.get("supported_document_types", [])
    ]


def extraction_plan_for_document_type(document_type: str) -> ExtractionPlan:
    keys = schema_keys_for_document_type(document_type)
    if not keys:
        return ExtractionPlan(status="skipped_not_supported", schema_keys=[])
    return ExtractionPlan(status="pending", schema_keys=keys)


def fact_type_rule(schema_key: str, fact_type: str) -> dict[str, Any]:
    schema = schema_entry(schema_key)
    for fact in schema.get("fact_types", []):
        if fact.get("fact_type") == fact_type:
            return fact
    raise ValueError(f"unsupported fact type for {schema_key}: {fact_type}")


def validate_fact_type(schema_key: str, fact_type: str) -> str:
    fact_type_rule(schema_key, fact_type)
    return fact_type


def validate_fact_scope(schema_key: str, fact_type: str, scope_level: str) -> str:
    rule = fact_type_rule(schema_key, fact_type)
    if scope_level not in set(rule.get("allowed_scope_levels", [])):
        raise ValueError(f"scope level {scope_level!r} is not allowed for {schema_key}.{fact_type}")
    return scope_level
