from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BeforeValidator, Field, model_validator

from app.schemas.master_data import Input, Note, Rate, decimal_string
from app.schemas.orders import Amount

SignedAmount = Annotated[
    Decimal, BeforeValidator(decimal_string), Field(max_digits=18, decimal_places=2)
]


class MovementCreate(Input):
    team_id: UUID
    business_date: date
    movement_type: Literal["received", "distributed", "adjustment"]
    cny_amount: SignedAmount
    order_id: UUID | None = None
    note: Note | None = None

    @model_validator(mode="after")
    def direction(self):
        if self.movement_type != "adjustment" and self.cny_amount <= 0:
            raise ValueError("Received/distributed amounts must be positive")
        return self


class ActivityCreate(Input):
    team_id: UUID
    business_date: date
    actual_cny_handled: Amount
    fee_rate: Rate


class ActivityEdit(ActivityCreate):
    updated_at: AwareDatetime


class FeePayment(Input):
    payment_date: date
    updated_at: AwareDatetime
