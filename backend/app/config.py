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

    anthropic_api_key: str = ""
    assessment_model: str = "claude-haiku-4-5"
    draft_model: str = "claude-sonnet-4-6"

    # DeepSeek (OpenAI-compatible). When set, used for assessment + drafting instead of Anthropic.
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
