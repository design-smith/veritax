from app.config import settings


def test_extraction_config_defaults_to_assessment_provider_and_model(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "deepseek_api_key", "also-present")
    monkeypatch.setattr(settings, "assessment_model", "claude-assess-test")
    monkeypatch.setattr(settings, "deepseek_model", "deepseek-test")
    monkeypatch.setattr(settings, "extraction_provider", "")
    monkeypatch.setattr(settings, "extraction_model", "")

    assert settings.resolved_extraction_provider() == "anthropic"
    assert settings.resolved_extraction_model() == "claude-assess-test"


def test_extraction_config_allows_explicit_provider_and_model(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    monkeypatch.setattr(settings, "assessment_model", "claude-assess-test")
    monkeypatch.setattr(settings, "extraction_provider", "deepseek")
    monkeypatch.setattr(settings, "extraction_model", "deepseek-extract-test")

    assert settings.resolved_extraction_provider() == "deepseek"
    assert settings.resolved_extraction_model() == "deepseek-extract-test"
