from datetime import date as Date
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.master_data import Repo, checked_context, reply
from app.core.auth import require_owner

router = APIRouter(dependencies=[Depends(require_owner)])
Section = Literal["orders", "money_in", "outflows", "pending", "teams"]


async def report(repo, day, section, limit, offset):
    await checked_context(repo)
    return reply(
        await repo.request(
            "POST",
            "rpc/daily_report",
            payload={
                "p_date": str(day),
                "p_section": section,
                "p_limit": limit,
                "p_offset": offset,
            },
        )
    )


@router.get("/dashboard/daily")
async def dashboard(repo: Repo, date: Date):
    return await report(repo, date, "orders", 5, 0)


@router.get("/recaps/daily")
async def recap(
    repo: Repo,
    date: Date,
    section: Section = "orders",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return await report(repo, date, section, limit, offset)
