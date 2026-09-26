from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BeforeValidator, Field, StringConstraints, model_validator

from app.schemas.master_data import Input, Note, Rate, decimal_string
from app.schemas.orders import Amount

Category = Literal["rmb_purchase", "team_fee", "atm_card_fee", "exchange_fee", "other"]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
IDR = Annotated[
    Decimal, BeforeValidator(decimal_string), Field(ge=0, max_digits=20, decimal_places=2)
]


class AtmCreate(Input):
    account_id: UUID | None = None
    business_date: date
    actual_cny_handled: Amount
    fee_rate: Rate
    note: Note | None = None


class AtmEdit(AtmCreate):
    updated_at: AwareDatetime


class Posting(Input):
    business_date: date
    description: Text
    amount_idr: IDR | None = None
    cny_amount: Amount | None = None
    rate_or_fee: Rate | None = None

    def validate_category(self, category):
        if category in {"exchange_fee", "other"}:
            if (
                self.amount_idr is None
                or self.cny_amount is not None
                or self.rate_or_fee is not None
            ):
                raise ValueError("Enter actual IDR only")
        elif self.cny_amount is None or self.rate_or_fee is None or self.amount_idr is not None:
            raise ValueError("Provide CNY and rate only; IDR is calculated")
        elif category == "rmb_purchase" and self.rate_or_fee <= 0:
            raise ValueError("Purchase rate must be positive")
        return self


class ManualOutflow(Posting):
    category: Literal["rmb_purchase", "exchange_fee", "other"]

    @model_validator(mode="after")
    def category_values(self):
        return self.validate_category(self.category)


class VoidOutflow(Input):
    reason: Text
    updated_at: AwareDatetime


class CorrectOutflow(Posting):
    reason: Text
    updated_at: AwareDatetime
