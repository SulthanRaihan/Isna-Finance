from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.profile import OwnerProfile

bearer = HTTPBearer(auto_error=False)


class AuthError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message


def unavailable() -> AuthError:
    return AuthError(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable.")


async def auth_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
        yield client


async def require_owner(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    client: Annotated[httpx.AsyncClient, Depends(auth_client)],
) -> OwnerProfile:
    if credentials is None:
        raise AuthError(401, "UNAUTHENTICATED", "Sign in to continue.")
    try:
        settings = get_settings()
    except ValidationError:
        raise unavailable() from None
    base_url = str(settings.supabase_url).rstrip("/")
    headers = {
        "apikey": settings.supabase_publishable_key,
        "Authorization": f"Bearer {credentials.credentials}",
    }
    try:
        # The project's Auth service validates the token; never trust decoded claims alone.
        identity = await client.get(f"{base_url}/auth/v1/user", headers=headers)
        if identity.status_code in (401, 403):
            raise AuthError(401, "UNAUTHENTICATED", "Sign in to continue.")
        if identity.status_code != 200:
            raise unavailable()
        user_id = UUID(identity.json()["id"])
        response = await client.get(
            f"{base_url}/rest/v1/profiles",
            headers=headers,
            params={"id": f"eq.{user_id}", "select": "id,display_name,role", "limit": "1"},
        )
        if response.status_code == 401:
            raise AuthError(401, "UNAUTHENTICATED", "Sign in to continue.")
        if response.status_code == 403:
            raise AuthError(403, "FORBIDDEN", "Owner access is required.")
        if response.status_code != 200:
            raise unavailable()
        profiles = response.json()
        if not isinstance(profiles, list):
            raise unavailable()
        if not profiles:
            raise AuthError(403, "FORBIDDEN", "Owner access is required.")
        profile = profiles[0]
        if profile.get("id") != str(user_id) or profile.get("role") != "owner":
            raise AuthError(403, "FORBIDDEN", "Owner access is required.")
        return OwnerProfile.model_validate(profile)
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
        raise unavailable() from None
