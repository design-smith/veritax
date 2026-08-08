from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://veritax:veritax@localhost:5432/veritax"
    database_connect_timeout: float = 4.0

    # Object storage. Leave S3_ENDPOINT_URL unset to use local filesystem storage (no bucket needed).
    s3_endpoint_url: str = ""
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "veritax-sources"
    s3_region: str = "us-east-1"
    storage_dir: str = "_storage"  # used by LocalStorage when S3 is not configured

    # OCR fallback for scanned PDFs. Normal PDF text extraction is tried first; OCR only runs
    # when the PDF text layer is effectively empty.
    ocr_enabled: bool = True
    ocr_command: str = "ocrmypdf"
    ocr_language: str = "eng"
    ocr_timeout_seconds: int = 600
    ocr_min_text_chars: int = 200

    voyage_api_key: str = ""
    embedding_model: str = "voyage-law-2"
    embedding_dim: int = 1024

    # ── LLM provider ─────────────────────────────────────────────────────────
    # LLM_PROVIDER: "deepseek" | "anthropic" | "fake". Blank = auto (first key that's set).
    # Set the models per provider with the *_MODEL env vars below.
    llm_provider: str = ""

    # Requirements assessed this many elements per LLM call (shared context sent once). 1 = strict
    # one-call-per-element (today's behaviour) — the instant rollback if batching ever regresses quality.
    assess_batch_size: int = 1
    draft_batch_size: int = 1
    # Optional extraction overrides. Blank means use the assessment provider/model.
    extraction_provider: str = ""
    extraction_model: str = ""

    # Anthropic — ASSESSMENT_MODEL (fast, per-requirement) + DRAFT_MODEL (quality, draft & risks).
    anthropic_api_key: str = ""
    assessment_model: str = "claude-haiku-4-5-20251001"
    draft_model: str = "claude-sonnet-4-6"

    # DeepSeek (OpenAI-compatible). DEEPSEEK_MODEL: deepseek-v4-flash (fast/cheap) or deepseek-v4-pro
    # (higher quality). ("deepseek-chat" was retired by DeepSeek.)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"

    # ── Supabase Auth ─────────────────────────────────────────────────────────
    # The frontend logs in with Supabase; this API verifies the access-token JWT on every request.
    # SUPABASE_URL drives the JWKS endpoint (asymmetric signing keys) and the issuer check.
    # SUPABASE_JWT_SECRET is only needed if the project still uses the legacy HS256 shared secret.
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwt_aud: str = "authenticated"

    cors_origins: str = "http://localhost:3000"
    cors_origin_regex: str = (
        r"^https://([a-z0-9-]+\.)?veritaxai\.com$"
        r"|^https://.*\.vercel\.app$"
        r"|^http://(localhost|127\.0\.0\.1):\d+$"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def resolved_llm_provider(self) -> str:
        provider = self.llm_provider.strip().lower()
        if provider:
            return provider
        if self.deepseek_api_key:
            return "deepseek"
        if self.anthropic_api_key:
            return "anthropic"
        return "fake"

    def resolved_assessment_model(self) -> str:
        provider = self.resolved_llm_provider()
        if provider == "deepseek":
            return self.deepseek_model
        if provider == "anthropic":
            return self.assessment_model
        return "fake"

    def resolved_extraction_provider(self) -> str:
        return self.extraction_provider.strip().lower() or self.resolved_llm_provider()

    def resolved_extraction_model(self) -> str:
        model = self.extraction_model.strip()
        if model:
            return model
        provider = self.resolved_extraction_provider()
        if provider == self.resolved_llm_provider():
            return self.resolved_assessment_model()
        if provider == "deepseek":
            return self.deepseek_model
        if provider == "anthropic":
            return self.assessment_model
        return "fake"


settings = Settings()
