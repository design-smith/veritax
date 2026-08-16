"""S1: the controlled, versioned FAR ontology. Pure/deterministic — no DB, no LLM."""
from app.functional import (
    assets,
    capabilities,
    characterizations,
    functions,
    ontology_version,
    risks,
    valid_asset,
    valid_capability,
    valid_characterization,
    valid_far_value,
    valid_function,
    valid_risk,
)
from app.functional.ontology import function_categories


def test_ontology_is_versioned():
    assert isinstance(ontology_version(), int) and ontology_version() >= 1


def test_functions_taxonomy_and_categories():
    fns = functions()
    assert {"sales", "customer_relationship_management", "manufacturing", "fx_management", "research"} <= fns
    assert valid_function("customer_relationship_management") and not valid_function("teleportation")
    cats = function_categories()
    assert set(cats) == {"commercial", "operational", "corporate_shared", "intellectual_property", "treasury_financing"}
    # Flattened set == union of the category lists (no drift).
    assert fns == frozenset(f for g in cats.values() for f in g)


def test_asset_risk_capability_characterization_taxonomies():
    assert {"patents", "workforce_in_place", "inventory"} <= assets() and not valid_asset("moon_dust")
    assert {"foreign_exchange_risk", "ip_risk", "inventory_risk"} <= risks() and not valid_risk("vibes_risk")
    assert {"contractual_assumption", "economic_exposure", "decision_making", "risk_control", "capability", "financial_capacity"} <= capabilities()
    assert valid_capability("decision_making")
    assert {"limited_risk_distributor", "undetermined"} <= characterizations()
    assert valid_characterization("undetermined") and not valid_characterization("supreme_overlord")


def test_valid_far_value_dispatches_by_fact_type():
    assert valid_far_value("function_performed", "sales")
    assert not valid_far_value("function_performed", "foreign_exchange_risk")   # right dispatch, wrong taxonomy
    assert valid_far_value("asset_used", "patents")
    assert valid_far_value("risk_assumed", "foreign_exchange_risk")
    assert valid_far_value("risk_controlled", "credit_risk")
    assert valid_far_value("capability", "decision_making")
    assert not valid_far_value("bogus_fact_type", "sales")                      # unknown fact_type → False
