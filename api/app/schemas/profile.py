from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class OwnerProfile(BaseModel):
    id: UUID
    display_name: str
    role: Literal["owner"]
