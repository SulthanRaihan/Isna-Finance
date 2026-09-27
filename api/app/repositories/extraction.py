import httpx

from app.core.config import get_settings
from app.repositories.master_data import DataError
from app.services.ai.images import MAX_BYTES

BUCKET = "isna-ai-temp"


class ExtractionRepository:
    """Only upload jobs, owned temporary objects and read-only customer candidates."""

    def __init__(self, client: httpx.AsyncClient, token: str):
        self.client = client
        config = get_settings()
        self.base = str(config.supabase_url).rstrip("/")
        self.headers = {
            "apikey": config.supabase_publishable_key,
            "Authorization": f"Bearer {token}",
        }

    async def job(self, action, job_id=None, mime=None, size=None):
        try:
            response = await self.client.post(
                self.base + "/rest/v1/rpc/ai_upload_job",
                headers=self.headers,
                json={
                    "p_action": action,
                    "p_id": str(job_id) if job_id else None,
                    "p_mime": mime,
                    "p_size": size,
                },
            )
            if not response.is_success:
                code = response.json().get("message")
                allowed = {
                    "AI_RATE_LIMIT": 429,
                    "AI_JOB_UNAVAILABLE": 409,
                    "NOT_FOUND": 404,
                    "AI_CLEANUP_UNAVAILABLE": 503,
                }
                raise DataError(
                    allowed.get(code, 503),
                    code if code in allowed else "AI_UNAVAILABLE",
                    "Extraction request unavailable.",
                )
            return response.json()
        except (httpx.HTTPError, ValueError):
            raise DataError(503, "AI_UNAVAILABLE", "Extraction request unavailable.") from None

    async def sign(self, path):
        try:
            response = await self.client.post(
                f"{self.base}/storage/v1/object/upload/sign/{BUCKET}/{path}",
                headers=self.headers,
                json={},
            )
            response.raise_for_status()
            relative = response.json()["url"]
            if not relative.startswith(f"/object/upload/sign/{BUCKET}/{path}?"):
                raise ValueError("unexpected storage URL")
            return self.base + "/storage/v1" + relative
        except (httpx.HTTPError, ValueError, KeyError):
            raise DataError(503, "AI_UNAVAILABLE", "Upload unavailable.") from None

    async def download(self, path):
        try:
            async with self.client.stream(
                "GET",
                f"{self.base}/storage/v1/object/authenticated/{BUCKET}/{path}",
                headers=self.headers,
            ) as response:
                response.raise_for_status()
                data = bytearray()
                async for part in response.aiter_bytes():
                    if len(data) + len(part) > MAX_BYTES:
                        raise DataError(422, "INVALID_IMAGE", "Image exceeds the upload limit.")
                    data.extend(part)
                return bytes(data)
        except httpx.HTTPError:
            raise DataError(503, "AI_UNAVAILABLE", "Image unavailable.") from None

    async def remove(self, path):
        try:
            response = await self.client.request(
                "DELETE",
                f"{self.base}/storage/v1/object/{BUCKET}",
                headers=self.headers,
                json={"prefixes": [path]},
            )
            response.raise_for_status()
        except httpx.HTTPError:
            raise DataError(
                503, "AI_CLEANUP_PENDING", "Cleanup pending. Please retry later."
            ) from None

    async def customers(self, text):
        if not text:
            return []
        escaped = (
            text.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
            .replace("*", "\\*")
        )
        try:
            response = await self.client.get(
                self.base + "/rest/v1/customers",
                headers=self.headers,
                params={
                    "select": "id,display_name,is_active",
                    "is_active": "eq.true",
                    "display_name": "ilike." + escaped,
                    "limit": "101",
                },
            )
            response.raise_for_status()
            items = response.json()
            return items if len(items) <= 100 else []
        except (httpx.HTTPError, ValueError, TypeError):
            raise DataError(503, "AI_UNAVAILABLE", "Customer lookup unavailable.") from None
