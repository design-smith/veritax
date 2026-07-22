from app.requirements import resolve_requirements


def test_counts_per_jurisdiction():
    assert len(resolve_requirements("Netherlands")) == 21   # 20 OECD + art 8b(3)
    assert len(resolve_requirements("United States")) == 10  # US 6662 principal docs
    assert len(resolve_requirements("Canada")) == 6          # s.247(4) items
    assert len(resolve_requirements("United Kingdom")) == 21  # 20 + Summary Audit Trail


def test_local_element_appended_and_ordered():
    uk = resolve_requirements("United Kingdom")
    last = uk[-1]
    assert last.order == 21
    assert last.element_name == "Summary Audit Trail"
    assert last.verified is True


def test_france_conditionals_flagged():
    fr = resolve_requirements("France")
    conditional = [e for e in fr if not e.required]
    assert len(conditional) == 2  # 223 quinquies B + non-cooperative-jurisdiction docs
    assert {e.order for e in conditional} == {21, 22}


def test_verified_flag_preserved():
    us = resolve_requirements("United States")
    by_order = {e.order: e for e in us}
    assert by_order[1].verified is True
    assert by_order[8].verified is False  # eCFR wording unverified


def test_requirement_key_and_unknown_country():
    nl = resolve_requirements("Netherlands")
    assert nl[0].requirement_key == "Netherlands:1"
    assert resolve_requirements("Narnia") == ()
