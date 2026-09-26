import json
from decimal import Decimal

import httpx
from pydantic import ValidationError

from app.core.auth import AuthError
from app.core.config import get_settings
from app.schemas.master_data import Assignment


class DataError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: dict | None = None):
        self.status, self.code, self.message = status, code, message
        self.fields = fields or {}


class MasterData:
    def __init__(self, client: httpx.AsyncClient, token: str):
        self.client = client
        self.settings = get_settings()
        self.headers = {
            "apikey": self.settings.supabase_publishable_key,
            "Authorization": f"Bearer {token}",
            "Prefer": "return=representation",
        }

    async def request(self, method: str, path: str, *, params=None, payload=None):
        try:
            response = await self.client.request(
                method,
                f"{str(self.settings.supabase_url).rstrip('/')}/rest/v1/{path}",
                headers=self.headers,
                params=params,
                json=payload,
            )
            data = response.json(parse_float=Decimal)
        except (httpx.HTTPError, ValueError):
            raise DataError(503, "DATA_UNAVAILABLE", "Data service unavailable.") from None
        if response.is_success:
            return data
        if response.status_code in (401, 403):
            raise AuthError(response.status_code, "ACCESS_DENIED", "Owner access is required.")
        if isinstance(data, dict):
            code = data.get("code")
            if data.get("message") == "ACCOUNT_ASSIGNED":
                try:
                    assignments = [
                        Assignment.model_validate(item).model_dump(mode="json")
                        for item in json.loads(data["details"])
                    ]
                except (ValueError, TypeError, KeyError, ValidationError):
                    raise DataError(
                        503, "DATA_UNAVAILABLE", "Could not read assignment conflicts."
                    ) from None
                raise DataError(
                    409,
                    "ACCOUNT_ASSIGNED",
                    "Resolve current/future assignments before deactivating this account.",
                    {"conflicting_assignments": assignments},
                )
            domain = data.get("message")
            if code == "P0001" and domain in {
                "ORDER_LOCKED",
                "ACTIVITY_LOCKED",
                "STALE_ACTIVITY",
                "STATE_CONFLICT",
                "STALE_ORDER",
                "IDEMPOTENCY_CONFLICT",
                "ACCOUNT_NOT_ASSIGNED",
                "INVALID_ORDER",
                "NOT_FOUND",
            }:
                status = (
                    404
                    if domain == "NOT_FOUND"
                    else 422
                    if domain in {"ACCOUNT_NOT_ASSIGNED", "INVALID_ORDER"}
                    else 409
                )
                raise DataError(
                    status, domain, "Order request rejected; review the current order and inputs."
                )
            if code == "23505":
                raise DataError(409, "DUPLICATE", "A record with this unique value already exists.")
            if code in ("22023", "23514", "23503", "23502", "22003", "22007", "22008"):
                raise DataError(
                    422, "VALIDATION_ERROR", "Check the selected accounts and input values."
                )
        raise DataError(503, "DATA_UNAVAILABLE", "Data service unavailable; verify the migration.")

    async def list(self, table, *, q, active, limit, offset):
        field = {"customers": "display_name", "accounts": "label", "teams": "name"}[table]
        params = {"select": "*", "order": f"{field}.asc,id.asc", "limit": limit, "offset": offset}
        if q:
            # Escape SQL LIKE wildcards; no PostgREST logical expression interpolation.
            escaped = (
                q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace("*", "\\*")
            )
            params[field] = f"ilike.%{escaped}%"
        if active is not None:
            params["is_active"] = f"eq.{str(active).lower()}"
        return {
            "items": await self.request("GET", table, params=params),
            "limit": limit,
            "offset": offset,
        }

    async def create(self, table, payload):
        rows = await self.request("POST", table, payload=payload)
        if not rows:
            raise DataError(503, "DATA_UNAVAILABLE", "Record was not returned.")
        return rows[0]

    async def patch(self, table, record_id, payload):
        rows = await self.request("PATCH", table, params={"id": f"eq.{record_id}"}, payload=payload)
        if not rows:
            raise DataError(404, "NOT_FOUND", "Record not found.")
        return rows[0]
