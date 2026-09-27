from pydantic import TypeAdapter, ValidationError

from app.schemas.extraction import RawExtraction
from app.schemas.orders import Amount, OrderRate


def make_draft(raw: RawExtraction, customers: list[dict]):
    warnings = []
    draft = {
        "customer_text": raw.customer_text,
        "matched_customer_id": None,
        "cny_amount": None,
        "customer_rate": None,
    }
    candidates = []
    confidence = raw.confidence.model_dump()
    if raw.multiple_orders:
        return {
            "draft": {k: None for k in draft},
            "candidates": [],
            "confidence": {k: 0 for k in confidence},
            "warnings": ["MULTIPLE_ORDERS"],
            "multiple_orders": True,
        }
    for key, kind in [("cny_amount", Amount), ("customer_rate", OrderRate)]:
        value = getattr(raw, key)
        try:
            draft[key] = format(TypeAdapter(kind).validate_python(value), "f")
        except ValidationError:
            confidence[key] = 0
            warnings.append("REVIEW_" + key.upper())
    if raw.customer_text:
        needle = raw.customer_text.strip().casefold()
        candidates = [
            {"id": str(c["id"]), "display_name": c["display_name"]}
            for c in customers
            if c.get("is_active", True) and c["display_name"].strip().casefold() == needle
        ]
    if len(candidates) == 1:
        draft["matched_customer_id"] = candidates[0]["id"]
    else:
        warnings.append("SELECT_CUSTOMER")
    warnings.append("REVIEW_DRAFT")
    return {
        "draft": draft,
        "candidates": candidates,
        "confidence": confidence,
        "warnings": warnings,
        "multiple_orders": False,
    }
