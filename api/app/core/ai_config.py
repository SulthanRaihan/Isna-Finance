from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AISettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env", extra="ignore"
    )
    ai_extraction_enabled: bool = False
    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = "qwen/qwen3.8-27b"
    groq_free_tier_confirmed: bool = False
