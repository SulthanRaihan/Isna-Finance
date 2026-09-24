from datetime import datetime

import pytest
from pydantic import ValidationError

from app.core.business_time import BusinessTimeSettings, business_date_at


@pytest.mark.parametrize(
    ("instant", "expected"),
    [
        ("2026-09-22T16:59:59+00:00", "2026-09-22"),
        ("2026-09-22T17:00:00+00:00", "2026-09-23"),
        ("2026-09-23T00:30:00+08:00", "2026-09-22"),
        ("2026-12-31T17:00:00+00:00", "2027-01-01"),
    ],
)
def test_business_day_boundaries(instant, expected):
    assert business_date_at(datetime.fromisoformat(instant), "Asia/Jakarta").isoformat() == expected


def test_explicit_timezone_override():
    settings = BusinessTimeSettings(_env_file=None, business_timezone="Asia/Shanghai")
    instant = datetime.fromisoformat("2026-09-22T16:30:00+00:00")
    assert business_date_at(instant, settings.business_timezone).isoformat() == "2026-09-23"
    assert business_date_at(instant, "Asia/Jakarta").isoformat() == "2026-09-22"


def test_unknown_timezone_rejected():
    with pytest.raises(ValidationError):
        BusinessTimeSettings(_env_file=None, business_timezone="Not/AZone")


def test_ambiguous_naive_timestamp_rejected():
    with pytest.raises(ValueError, match="offset-aware"):
        business_date_at(datetime(2026, 9, 23), "Asia/Jakarta")
