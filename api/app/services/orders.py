from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, localcontext

from app.core.business_time import business_date_at, get_business_time_settings
from app.repositories.master_data import DataError


def expected_idr(amount: Decimal, rate: Decimal) -> Decimal:
    with localcontext() as context:
        context.prec = 50
        result = (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if result >= Decimal("1000000000000000000"):
        raise DataError(422, "AMOUNT_OVERFLOW", "Calculated IDR exceeds storage limits.")
    return result


def present_order(row):
    row = dict(row)
    received = row["payment_status"] == "received"
    sent = row["fulfillment_status"] == "sent"
    row["ui_status"] = (
        "completed"
        if received and sent
        else "ready_to_send"
        if received
        else "sent_awaiting_payment"
        if sent
        else "awaiting_payment"
    )
    row["warnings"] = ["RMB sudah dikirim, IDR belum diterima."] if sent and not received else []
    row["money_in_date"] = None
    if received:
        stamp = datetime.fromisoformat(row["idr_received_at"].replace("Z", "+00:00"))
        row["money_in_date"] = str(
            business_date_at(stamp, get_business_time_settings().business_timezone)
        )
    for field, places in (("cny_amount", 2), ("customer_rate", 6), ("expected_idr", 2)):
        row[field] = format(Decimal(str(row[field])), f".{places}f")
    return row
