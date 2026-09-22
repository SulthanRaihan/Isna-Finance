from functools import lru_cache
from pathlib import Path

from pydantic import HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env", extra="ignore"
    )
    supabase_url: HttpUrl
    supabase_publishable_key: str

    @field_validator("supabase_url")
    @classmethod
    def require_https(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https" or value.username or value.password:
            raise ValueError("Use an HTTPS Supabase project URL")
        return value

    @field_validator("supabase_publishable_key")
    @classmethod
    def require_public_key(cls, value: str) -> str:
        if not value.startswith("sb_publishable_"):
            raise ValueError("Use a Supabase publishable key")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
