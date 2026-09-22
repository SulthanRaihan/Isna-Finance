from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.core.auth import require_owner
from app.schemas.profile import OwnerProfile

router = APIRouter(tags=["identity"])


@router.get("/me", response_model=OwnerProfile)
async def current_owner(
    response: Response, owner: Annotated[OwnerProfile, Depends(require_owner)]
) -> OwnerProfile:
    response.headers["Cache-Control"] = "private, no-store"
    return owner
