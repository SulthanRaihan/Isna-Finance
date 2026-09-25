from datetime import date
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, BeforeValidator, Field, model_validator

from app.schemas.master_data import Input, Note, decimal_string

Amount = Annotated[
    Decimal, BeforeValidator(decimal_string), Field(gt=0, max_digits=18, decimal_places=2)
]
OrderRate = Annotated[
    Decimal, BeforeValidator(decimal_string), Field(gt=0, max_digits=18, decimal_places=6)
]


class OrderCreate(Input):
    customer_id: UUID
    business_date: date
    cny_amount: Amount
    customer_rate: OrderRate
    receiving_account_id: UUID
    note: Note | None = None


class OrderPatch(Input):
    customer_id: UUID | None = None
    business_date: date | None = None
    cny_amount: Amount | None = None
    customer_rate: OrderRate | None = None
    receiving_account_id: UUID | None = None
    note: Note | None = None

    @model_validator(mode="after")
    def valid_patch(self):
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set - {"note"}
        ):
            raise ValueError("Provide non-null editable fields")
        return self


class ReceivePayment(Input):
    received_at: AwareDatetime


class MarkSent(Input):
    sent_at: AwareDatetime
