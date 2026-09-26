from datetime import date as Date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.master_data import Repo, checked_context, reply
from app.api.orders import Key
from app.api.team_activity import present
from app.core.auth import require_owner
from app.repositories.master_data import DataError
from app.schemas.money_out import (
    AtmCreate,
    AtmEdit,
    Category,
    CorrectOutflow,
    ManualOutflow,
    Posting,
    VoidOutflow,
)
from app.schemas.team_activity import FeePayment
from app.services.money_out import current_postings
from app.services.orders import expected_idr

router = APIRouter(dependencies=[Depends(require_owner)])


async def mutate(repo, operation, body, key, record_id=None):
    await checked_context(repo)
    payload = body.model_dump(mode="json", exclude_none=True)
    if isinstance(body, AtmCreate):
        payload["actual_cny_handled"] = format(body.actual_cny_handled, ".2f")
        payload["fee_rate"] = format(body.fee_rate, ".6f")
        payload["calculated_fee_idr"] = str(expected_idr(body.actual_cny_handled, body.fee_rate))
    if isinstance(body, Posting):
        if body.cny_amount is not None and body.rate_or_fee is not None:
            payload["cny_amount"] = format(body.cny_amount, ".2f")
            payload["rate_or_fee"] = format(body.rate_or_fee, ".6f")
            payload["amount_idr"] = str(expected_idr(body.cny_amount, body.rate_or_fee))
        elif body.amount_idr is not None:
            payload["amount_idr"] = format(body.amount_idr, ".2f")
    return await repo.request(
        "POST",
        "rpc/mutate_money_out",
        payload={
            "p_operation": operation,
            "p_payload": payload,
            "p_key": key,
            "p_id": str(record_id) if record_id else None,
        },
    )


@router.get("/atm-activities")
async def activities(
    repo: Repo,
    date: Date | None = None,
    account_id: UUID | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    await checked_context(repo)
    params = {
        "order": "business_date.desc,created_at.desc,id.desc",
        "limit": limit,
        "offset": offset,
    }
    if date:
        params["business_date"] = f"eq.{date}"
    if account_id:
        params["account_id"] = f"eq.{account_id}"
    rows = await repo.request("GET", "atm_card_activities", params=params)
    return reply(
        {
            "items": await current_postings(repo, [present(r) for r in rows], "atm_card_activity"),
            "limit": limit,
            "offset": offset,
        }
    )


@router.post("/atm-activities")
async def create_atm(body: AtmCreate, repo: Repo, key: Key):
    return reply(await mutate(repo, "atm_create", body, key), 201)


@router.patch("/atm-activities/{activity_id}")
async def edit_atm(activity_id: UUID, body: AtmEdit, repo: Repo, key: Key):
    return reply(await mutate(repo, "atm_edit", body, key, activity_id))


@router.post("/atm-activities/{activity_id}/pay")
async def pay_atm(activity_id: UUID, body: FeePayment, repo: Repo, key: Key):
    return reply(await mutate(repo, "atm_pay", body, key, activity_id))


@router.post("/outflows")
async def create_outflow(body: ManualOutflow, repo: Repo, key: Key):
    return reply(await mutate(repo, "create", body, key), 201)


@router.get("/outflows")
async def outflows(
    repo: Repo,
    date: Date | None = None,
    category: Category | None = None,
    status: Literal["posted", "voided", "all"] = "posted",
    source_type: Literal["team_daily_activity", "atm_card_activity"] | None = None,
    source_id: UUID | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    await checked_context(repo)
    params = {
        "order": "business_date.desc,created_at.desc,id.desc",
        "limit": limit,
        "offset": offset,
    }
    for field, value in (
        ("business_date", date),
        ("category", category),
        ("source_type", source_type),
        ("source_id", source_id),
    ):
        if value is not None:
            params[field] = f"eq.{value}"
    if status != "all":
        params["status"] = f"eq.{status}"
    rows = await repo.request("GET", "financial_outflows", params=params)
    return reply({"items": [present(r) for r in rows], "limit": limit, "offset": offset})


@router.get("/outflows/{outflow_id}")
async def detail(outflow_id: UUID, repo: Repo):
    await checked_context(repo)
    return reply(
        await repo.request("POST", "rpc/outflow_detail", payload={"p_id": str(outflow_id)})
    )


@router.post("/outflows/{outflow_id}/void")
async def void(outflow_id: UUID, body: VoidOutflow, repo: Repo, key: Key):
    return reply(await mutate(repo, "void", body, key, outflow_id))


@router.post("/outflows/{outflow_id}/correct")
async def correct(outflow_id: UUID, body: CorrectOutflow, repo: Repo, key: Key):
    await checked_context(repo)
    rows = await repo.request(
        "GET", "financial_outflows", params={"id": f"eq.{outflow_id}", "limit": 1}
    )
    if not rows:
        raise DataError(404, "NOT_FOUND", "Outflow not found.")
    try:
        body.validate_category(rows[0]["category"])
    except ValueError:
        raise DataError(
            422, "VALIDATION_ERROR", "Check the category-specific correction values."
        ) from None
    return reply(await mutate(repo, "correct", body, key, outflow_id))
