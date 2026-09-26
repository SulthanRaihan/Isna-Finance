from datetime import UTC
from datetime import date as Date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from app.api.master_data import Repo, checked_context, reply
from app.core.auth import require_owner
from app.repositories.master_data import DataError
from app.schemas.orders import MarkSent, OrderCreate, OrderPatch, ReceivePayment
from app.services.orders import expected_idr, present_order

router = APIRouter(dependencies=[Depends(require_owner)])
Key = Annotated[
    str, Header(alias="Idempotency-Key", min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
]
SELECT = (
    "*,customer:customers!inner(id,display_name,is_active),"
    "account:accounts(id,label,bank_name,account_last4)"
)


async def get_order(repo, order_id):
    rows = await repo.request("GET", "orders", params={"id": f"eq.{order_id}", "select": SELECT})
    if not rows:
        raise DataError(404, "NOT_FOUND", "Order not found.")
    return rows[0]


async def mutate(repo, operation, payload, *, order_id=None, key=None, version=None):
    return await repo.request(
        "POST",
        "rpc/mutate_order",
        payload={
            "p_operation": operation,
            "p_payload": payload,
            "p_id": str(order_id) if order_id else None,
            "p_key": key,
            "p_version": version,
        },
    )


@router.post("/orders")
async def create_order(body: OrderCreate, repo: Repo, key: Key):
    await checked_context(repo)
    payload = body.model_dump(mode="json")
    payload["cny_amount"] = format(body.cny_amount, ".2f")
    payload["customer_rate"] = format(body.customer_rate, ".6f")
    payload["expected_idr"] = str(expected_idr(body.cny_amount, body.customer_rate))
    result = await mutate(repo, "create", payload, key=key)
    return reply(present_order(result), 201)


@router.get("/orders")
async def list_orders(
    repo: Repo,
    date: Date | None = None,
    date_from: Date | None = None,
    date_to: Date | None = None,
    customer_id: UUID | None = None,
    receiving_account_id: UUID | None = None,
    payment_status: Literal["awaiting", "received"] | None = None,
    fulfillment_status: Literal["pending", "sent"] | None = None,
    q: str = Query("", max_length=120),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    await checked_context(repo)
    if date_from and date_to and date_from > date_to:
        raise DataError(422, "VALIDATION_ERROR", "Invalid date range.")
    params = {
        "select": SELECT,
        "order": "business_date.desc,created_at.desc,id.desc",
        "limit": limit,
        "offset": offset,
    }
    if date:
        params["business_date"] = f"eq.{date}"
    else:
        bounds = []
        if date_from:
            bounds.append(f"business_date.gte.{date_from}")
        if date_to:
            bounds.append(f"business_date.lte.{date_to}")
        if bounds:
            params["and"] = "(" + ",".join(bounds) + ")"
    for field, value in (
        ("customer_id", customer_id),
        ("receiving_account_id", receiving_account_id),
        ("payment_status", payment_status),
        ("fulfillment_status", fulfillment_status),
    ):
        if value is not None:
            params[field] = f"eq.{value}"
    if q.strip():
        escaped = (
            q.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
            .replace("*", "\\*")
        )
        params["customer.display_name"] = f"ilike.%{escaped}%"
    rows = await repo.request("GET", "orders", params=params)
    return reply({"items": [present_order(row) for row in rows], "limit": limit, "offset": offset})


@router.get("/orders/{order_id}")
async def order_detail(order_id: UUID, repo: Repo):
    await checked_context(repo)
    row = present_order(await get_order(repo, order_id))
    row["audit"] = await audit_rows(repo, order_id)
    movements = await repo.request(
        "GET",
        "team_movements",
        params={
            "order_id": f"eq.{order_id}",
            "order": "business_date.desc,created_at.desc,id.desc",
            "limit": 21,
        },
    )
    row["team_movements"] = [
        dict(m, cny_amount=format(Decimal(str(m["cny_amount"])), ".2f")) for m in movements[:20]
    ]
    row["team_movements_has_more"] = len(movements) > 20
    return reply(row)


async def audit_rows(repo, order_id):
    return await repo.request(
        "GET",
        "audit_logs",
        params={
            "entity_type": "eq.orders",
            "entity_id": f"eq.{order_id}",
            "order": "created_at.asc,id.asc",
        },
    )


@router.get("/audit/orders/{order_id}")
async def order_audit(order_id: UUID, repo: Repo):
    await get_order(repo, order_id)
    return reply({"items": await audit_rows(repo, order_id)})


@router.patch("/orders/{order_id}")
async def patch_order(order_id: UUID, body: OrderPatch, repo: Repo):
    await checked_context(repo)
    current = await get_order(repo, order_id)
    payload = body.model_dump(mode="json", exclude_unset=True)
    if {"cny_amount", "customer_rate"} & payload.keys():
        payload["expected_idr"] = str(
            expected_idr(
                body.cny_amount
                if body.cny_amount is not None
                else Decimal(str(current["cny_amount"])),
                body.customer_rate
                if body.customer_rate is not None
                else Decimal(str(current["customer_rate"])),
            )
        )
    result = await mutate(repo, "edit", payload, order_id=order_id, version=current["updated_at"])
    return reply(present_order(result))


@router.post("/orders/{order_id}/receive-payment")
async def receive_payment(order_id: UUID, body: ReceivePayment, repo: Repo, key: Key):
    await checked_context(repo)
    return reply(
        present_order(
            await mutate(
                repo,
                "receive",
                {"received_at": body.received_at.astimezone(UTC).isoformat()},
                order_id=order_id,
                key=key,
            )
        )
    )


@router.post("/orders/{order_id}/mark-sent")
async def mark_sent(order_id: UUID, body: MarkSent, repo: Repo, key: Key):
    await checked_context(repo)
    return reply(
        present_order(
            await mutate(
                repo,
                "send",
                {"sent_at": body.sent_at.astimezone(UTC).isoformat()},
                order_id=order_id,
                key=key,
            )
        )
    )
