from datetime import date as Date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.master_data import Repo, checked_context, reply
from app.api.orders import Key
from app.core.auth import require_owner
from app.schemas.team_activity import ActivityCreate, ActivityEdit, FeePayment, MovementCreate
from app.services.orders import expected_idr

router = APIRouter(dependencies=[Depends(require_owner)])


def present(row):
    row = dict(row)
    for field, places in (
        ("cny_amount", 2),
        ("actual_cny_handled", 2),
        ("fee_rate", 6),
        ("calculated_fee_idr", 2),
    ):
        if row.get(field) is not None:
            row[field] = format(Decimal(str(row[field])), f".{places}f")
    return row


async def mutate(repo, operation, body, key, activity_id=None):
    await checked_context(repo)
    payload = body.model_dump(mode="json")
    if isinstance(body, ActivityCreate):
        payload["actual_cny_handled"] = format(body.actual_cny_handled, ".2f")
        payload["fee_rate"] = format(body.fee_rate, ".6f")
        payload["calculated_fee_idr"] = str(expected_idr(body.actual_cny_handled, body.fee_rate))
    if isinstance(body, MovementCreate):
        payload["cny_amount"] = format(body.cny_amount, ".2f")
    return await repo.request(
        "POST",
        "rpc/mutate_team_activity",
        payload={
            "p_operation": operation,
            "p_payload": payload,
            "p_key": key,
            "p_id": str(activity_id) if activity_id else None,
        },
    )


@router.post("/team-movements")
async def create_movement(body: MovementCreate, repo: Repo, key: Key):
    return reply(await mutate(repo, "movement", body, key), 201)


@router.get("/team-movements")
async def linked_movements(
    repo: Repo, order_id: UUID, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)
):
    await checked_context(repo)
    rows = await repo.request(
        "GET",
        "team_movements",
        params={
            "order_id": f"eq.{order_id}",
            "order": "business_date.desc,created_at.desc,id.desc",
            "limit": limit,
            "offset": offset,
        },
    )
    return reply({"items": [present(r) for r in rows], "limit": limit, "offset": offset})


@router.get("/teams/{team_id}/ledger")
async def ledger(
    team_id: UUID,
    repo: Repo,
    date: Date,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    await checked_context(repo)
    return reply(
        await repo.request(
            "POST",
            "rpc/team_ledger",
            payload={
                "p_team": str(team_id),
                "p_date": str(date),
                "p_limit": limit,
                "p_offset": offset,
            },
        )
    )


@router.get("/team-activities")
async def activities(
    repo: Repo,
    team_id: UUID,
    date: Date | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    await checked_context(repo)
    params = {
        "team_id": f"eq.{team_id}",
        "order": "business_date.desc,id.desc",
        "limit": limit,
        "offset": offset,
    }
    if date:
        params["business_date"] = f"eq.{date}"
    rows = await repo.request("GET", "team_daily_activities", params=params)
    return reply({"items": [present(r) for r in rows], "limit": limit, "offset": offset})


@router.post("/team-activities")
async def create_activity(body: ActivityCreate, repo: Repo, key: Key):
    return reply(await mutate(repo, "create", body, key), 201)


@router.patch("/team-activities/{activity_id}")
async def edit_activity(activity_id: UUID, body: ActivityEdit, repo: Repo, key: Key):
    return reply(await mutate(repo, "edit", body, key, activity_id))


@router.post("/team-activities/{activity_id}/pay")
async def pay_fee(activity_id: UUID, body: FeePayment, repo: Repo, key: Key):
    return reply(await mutate(repo, "pay", body, key, activity_id))
