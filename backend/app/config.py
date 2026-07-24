from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://veritax:veritax@localhost:5432/veritax"

    # Object storage. Leave S3_ENDPOINT_URL unset to use local filesystem storage (no bucket needed).
    s3_endpoint_url: str = ""
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "veritax-sources"
    s3_region: str = "us-east-1"
    storage_dir: str = "_storage"  # used by LocalStorage when S3 is not configured

    voyage_api_key: str = ""
    embedding_model: str = "voyage-law-2"
    embedding_dim: int = 1024

    # ── LLM provider ─────────────────────────────────────────────────────────
    # LLM_PROVIDER: "deepseek" | "anthropic" | "fake". Blank = auto (first key that's set).
    # Set the models per provider with the *_MODEL env vars below.
    llm_provider: str = ""

    # Anthropic — ASSESSMENT_MODEL (fast, per-requirement) + DRAFT_MODEL (quality, draft & risks).
    anthropic_api_key: str = ""
    assessment_model: str = "claude-haiku-4-5-20251001"
    draft_model: str = "claude-sonnet-4-6"

    # DeepSeek (OpenAI-compatible). DEEPSEEK_MODEL: deepseek-v4-flash (fast/cheap) or deepseek-v4-pro
    # (higher quality). ("deepseek-chat" was retired by DeepSeek.)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"

    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
