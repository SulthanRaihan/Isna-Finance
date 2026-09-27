from urllib.parse import urlsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class SecuritySettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="api_", extra="ignore")
    cors_origins: list[str] = []

    @field_validator("cors_origins")
    @classmethod
    def exact_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.path
                or parsed.query
                or parsed.fragment
                or "*" in origin
                or origin != f"{parsed.scheme}://{parsed.netloc}"
                or (
                    parsed.scheme != "https"
                    and not (
                        parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
                    )
                )
            ):
                raise ValueError("Use exact HTTPS origins, or loopback HTTP for development")
            _ = parsed.port
        return origins
