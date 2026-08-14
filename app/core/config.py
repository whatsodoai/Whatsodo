from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")
    version: str = Field(default="0.1.0")

    # Database / cache — required, app must fail fast if missing
    database_url: str
    redis_url: str

    # Auth
    jwt_secret_key: str
    jwt_access_token_ttl_minutes: int = 15
    jwt_refresh_token_ttl_days: int = 30

    # Web / CORS
    cors_allowed_origins: str = "http://localhost:3000"
    cookie_domain: str = "localhost"

    # Email
    email_sender_provider: str = "console"
    email_from_address: str = "no-reply@whatsodo.ai"
    resend_api_key: str | None = None
    postmark_api_key: str | None = None

    # Anticipated future integrations — never required in Phase 1
    meta_app_id: str | None = None
    meta_app_secret: str | None = None
    meta_config_id: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_verify_token: str | None = None
    openai_api_key: str | None = None
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None

    sentry_dsn: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
