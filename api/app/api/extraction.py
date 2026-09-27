import asyncio
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials

from app.api.master_data import reply
from app.core.ai_config import AISettings
from app.core.auth import auth_client, bearer, require_owner
from app.repositories.extraction import ExtractionRepository
from app.repositories.master_data import DataError
from app.schemas.extraction import ExtractRequest, UploadTicket
from app.services.ai.drafts import make_draft
from app.services.ai.images import validate_image
from app.services.ai.provider import OpenAIProvider, VisionExtractionProvider

router = APIRouter(dependencies=[Depends(require_owner)])


def extraction_repository(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    client: Annotated[httpx.AsyncClient, Depends(auth_client)],
):
    return ExtractionRepository(client, credentials.credentials)


def enabled_settings():
    settings = AISettings()
    if not settings.ai_extraction_enabled or not settings.openai_api_key.get_secret_value():
        raise DataError(503, "AI_DISABLED", "Extraction is not configured. Use manual Quick Order.")
    return settings


Repo = Annotated[ExtractionRepository, Depends(extraction_repository)]


@router.post("/ai/uploads")
async def create_upload(body: UploadTicket, repo: Repo):
    enabled_settings()
    job = await repo.job("create", mime=body.mime_type, size=body.size_bytes)
    try:
        url = await repo.sign(job["object_path"])
        return reply({"job_id": job["id"], "upload_url": url})
    except Exception:
        await repo.job("finish", job["id"])
        raise


@router.post("/ai/extract-order")
async def extract_order(
    body: ExtractRequest, repo: Repo, client: Annotated[httpx.AsyncClient, Depends(auth_client)]
):
    settings = enabled_settings()
    job = await repo.job("claim", body.job_id)
    try:
        data = await repo.download(job["object_path"])
        if len(data) != job["size_bytes"]:
            raise DataError(422, "INVALID_IMAGE", "Uploaded size differs from the ticket.")
        validate_image(data, job["mime_type"])
        provider: VisionExtractionProvider = OpenAIProvider(client, settings)
        try:
            raw = await asyncio.wait_for(provider.extract_order(data, job["mime_type"]), timeout=60)
        except TimeoutError:
            raise DataError(
                503, "AI_UNAVAILABLE", "Extraction timed out. Use manual Quick Order."
            ) from None
        customers = [] if raw.multiple_orders else await repo.customers(raw.customer_text)
        result = make_draft(raw, customers)
    finally:
        await repo.remove(job["object_path"])
        await repo.job("finish", body.job_id)
    return reply(result)


@router.delete("/ai/uploads/{job_id}")
async def cancel_upload(job_id: UUID, repo: Repo):
    job = await repo.job("read", job_id)
    await repo.remove(job["object_path"])
    await repo.job("finish", job_id)
    return reply({"removed": True})
