"""Shared business calendar; never use the host's implicit timezone."""

from datetime import UTC, date, datetime
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BusinessTimeSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env", extra="ignore"
    )
    business_timezone: str = "Asia/Jakarta"

    @field_validator("business_timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("BUSINESS_TIMEZONE must be a valid IANA timezone") from error
        return value


@lru_cache
def get_business_time_settings() -> BusinessTimeSettings:
    return BusinessTimeSettings()


def business_date_at(instant: datetime, timezone: str) -> date:
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError("An offset-aware timestamp is required")
    return instant.astimezone(ZoneInfo(timezone)).date()


def business_today() -> date:
    settings = get_business_time_settings()
    return business_date_at(datetime.now(UTC), settings.business_timezone)
