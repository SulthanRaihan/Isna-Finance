from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.master_data import Input


class UploadTicket(Input):
    mime_type: Literal["image/png", "image/jpeg"]
    size_bytes: int = Field(strict=True, ge=1, le=5_000_000)


class ExtractRequest(Input):
    job_id: UUID


class Confidence(Input):
    customer: float = Field(ge=0, le=1)
    cny_amount: float = Field(ge=0, le=1)
    customer_rate: float = Field(ge=0, le=1)


class RawExtraction(Input):
    multiple_orders: bool
    customer_text: str | None = Field(max_length=120)
    cny_amount: str | None = Field(max_length=40)
    customer_rate: str | None = Field(max_length=40)
    confidence: Confidence
