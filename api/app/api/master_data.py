from datetime import date
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from app.core.auth import auth_client, bearer, require_owner
from app.core.business_time import get_business_time_settings
from app.repositories.master_data import DataError, MasterData
from app.schemas.master_data import (
    AccountCreate,
    AccountPatch,
    CustomerCreate,
    CustomerPatch,
    DailyChoices,
    TeamCreate,
)

router = APIRouter(dependencies=[Depends(require_owner)])


def repository(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    client: Annotated[httpx.AsyncClient, Depends(auth_client)],
):
    return MasterData(client, credentials.credentials)


Repo = Annotated[MasterData, Depends(repository)]


def reply(data, status=200):
    return JSONResponse(
        jsonable_encoder(data, custom_encoder={Decimal: str}),
        status_code=status,
        headers={"Cache-Control": "private, no-store"},
    )


async def checked_context(repo):
    context = await repo.request("POST", "rpc/business_context", payload={})
    try:
        timezone = get_business_time_settings().business_timezone
    except ValidationError:
        raise DataError(
            503, "TIMEZONE_MISMATCH", "Invalid business timezone configuration."
        ) from None
    if context.get("timezone") != timezone:
        raise DataError(503, "TIMEZONE_MISMATCH", "API and database business timezones must match.")
    return context


@router.get("/business-context")
async def business_context(repo: Repo):
    return reply(await checked_context(repo))


@router.get("/customers")
@router.get("/accounts")
@router.get("/teams")
async def list_records(
    request: Request,
    repo: Repo,
    q: str = Query("", max_length=120),
    active: bool | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    table = request.url.path.rsplit("/", 1)[-1]
    return reply(await repo.list(table, q=q.strip(), active=active, limit=limit, offset=offset))


@router.post("/customers")
async def create_customer(body: CustomerCreate, repo: Repo):
    return reply(await repo.create("customers", body.model_dump(mode="json")), 201)


@router.patch("/customers/{record_id}")
async def patch_customer(record_id: UUID, body: CustomerPatch, repo: Repo):
    return reply(
        await repo.patch("customers", record_id, body.model_dump(mode="json", exclude_unset=True))
    )


@router.post("/accounts")
async def create_account(body: AccountCreate, repo: Repo):
    return reply(await repo.create("accounts", body.model_dump(mode="json")), 201)


@router.patch("/accounts/{record_id}")
async def patch_account(record_id: UUID, body: AccountPatch, repo: Repo):
    await checked_context(repo)
    return reply(
        await repo.patch("accounts", record_id, body.model_dump(mode="json", exclude_unset=True))
    )


@router.post("/teams")
async def create_team(body: TeamCreate, repo: Repo):
    return reply(await repo.create("teams", body.model_dump(mode="json")), 201)


@router.get("/daily-accounts")
async def get_daily(repo: Repo, day: Annotated[date, Query(alias="date")]):
    await checked_context(repo)
    rows = await repo.request(
        "GET",
        "daily_account_assignments",
        params={"business_date": f"eq.{day}", "select": "*", "order": "account_id.asc"},
    )
    return reply({"business_date": day, "assignments": rows})


@router.put("/daily-accounts/{day}")
async def replace_daily(day: date, body: DailyChoices, repo: Repo):
    await checked_context(repo)
    rows = await repo.request(
        "POST",
        "rpc/replace_daily_accounts",
        payload={
            "p_date": str(day),
            "p_account_ids": [str(value) for value in body.active_account_ids],
            "p_default": str(body.default_account_id) if body.default_account_id else None,
        },
    )
    return reply({"business_date": day, "assignments": rows})
