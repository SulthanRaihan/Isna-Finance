from datetime import date
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Note = Annotated[str, StringConstraints(max_length=2000)]
Country = Annotated[str, StringConstraints(pattern=r"^[A-Z]{2}$")]
Last4 = Annotated[str, StringConstraints(pattern=r"^[0-9]{4}$")]
Kind = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


def decimal_string(value):
    if not isinstance(value, str):
        raise ValueError("Use a decimal string")
    return value


Rate = Annotated[
    Decimal, BeforeValidator(decimal_string), Field(ge=0, max_digits=18, decimal_places=6)
]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CustomerCreate(Input):
    display_name: Name
    note: Note | None = None


class CustomerPatch(Input):
    display_name: Name | None = None
    note: Note | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def valid_patch(self):
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set - {"note"}
        ):
            raise ValueError("Provide non-null editable fields")
        return self


class AccountCreate(Input):
    label: Name
    bank_name: Name
    country_code: Country
    account_last4: Last4 | None = None
    account_type: Kind | None = None


class AccountPatch(Input):
    label: Name | None = None
    bank_name: Name | None = None
    country_code: Country | None = None
    account_last4: Last4 | None = None
    account_type: Kind | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def valid_patch(self):
        nullable = {"account_last4", "account_type"}
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set - nullable
        ):
            raise ValueError("Provide non-null editable fields")
        return self


class TeamCreate(Input):
    name: Name
    default_fee_rate: Rate = Decimal("2.000000")


class DailyChoices(Input):
    active_account_ids: list[UUID] = Field(max_length=100)
    default_account_id: UUID | None = None

    @model_validator(mode="after")
    def consistent_default(self):
        if len(self.active_account_ids) != len(set(self.active_account_ids)):
            raise ValueError("Accounts cannot be repeated")
        if self.default_account_id and self.default_account_id not in self.active_account_ids:
            raise ValueError("Default account must be selected")
        return self


class Assignment(Input):
    business_date: date
    account_id: UUID
    is_default: bool
