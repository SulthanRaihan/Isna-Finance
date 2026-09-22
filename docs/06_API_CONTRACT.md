# API Contract v1

## Business-date semantics (approved clarification)

The standardized date field is `business_date`; its meaning depends on the record:

- `orders.business_date`: the operational/order date.
- `financial_outflows.business_date`: the actual date the money went out.
- `team_movements.business_date`, `team_daily_activities.business_date`, and
  `atm_card_activities.business_date`: the date the activity actually occurred.
- Money In is recognized only for payment status `received`, on the business-local
  date derived from `idr_received_at` using the configured business timezone.
  Never use `orders.business_date` or `created_at` as the Money In recognition date.

An activity date and its outflow date have different meanings; do not assume they
are interchangeable. These definitions clarify field naming without changing
financial recognition rules.

Base prefix: `/api/v1`

FastAPI owns authoritative validation and financial calculations.
Next.js must not bypass these write APIs for financial/domain records.

## M0 infrastructure endpoint

`GET /api/v1/health` is public and returns HTTP 200 with `{"status":"ok"}`.
It reports process liveness only. It performs no database or external-service
checks and exposes no secrets or business data. All domain endpoints below
remain specifications for later milestones.

## Conventions

### Authentication

All protected requests use the authenticated Supabase user identity.
FastAPI validates the token and applies authorization.

### Money representation

JSON financial values are transmitted as **decimal strings**, not binary
floats.

Example:

``` json
{
  "cny_amount": "10000.00",
  "customer_rate": "2647.000000"
}
```

### Dates

-   `business_date`: `YYYY-MM-DD`
-   timestamps: ISO-8601
-   daily reporting uses configured business timezone

### Error envelope

``` json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "fields": {}
  }
}
```

### Idempotency

Financial create/confirm operations should accept:
`Idempotency-Key: <uuid-or-client-generated-key>`

Repeated requests with the same key must not create duplicate financial
records.

------------------------------------------------------------------------

# Customers

## GET `/customers`

Query: - `q` optional - `active` optional - pagination

Returns customer summaries.

## POST `/customers`

``` json
{
  "display_name": "Customer Demo",
  "note": null
}
```

## PATCH `/customers/{customer_id}`

Editable non-financial customer fields.

------------------------------------------------------------------------

# Accounts

## GET `/accounts`

Returns masked account data only for normal UI.

## POST `/accounts`

``` json
{
  "label": "BCA Account 01",
  "bank_name": "BCA",
  "country_code": "ID",
  "account_last4": "4821",
  "account_type": "receiving"
}
```

## PATCH `/accounts/{account_id}`

Activation/metadata changes.

## GET `/daily-accounts?date=2026-09-20`

Returns active accounts and the default.

## PUT `/daily-accounts/{date}`

``` json
{
  "active_account_ids": ["uuid-1", "uuid-2"],
  "default_account_id": "uuid-1"
}
```

Rules: - default must be included in active accounts - at most one
default

------------------------------------------------------------------------

# Orders

## POST `/orders`

Core manual order creation endpoint.

Request:

``` json
{
  "customer_id": "uuid",
  "business_date": "2026-09-20",
  "cny_amount": "10000.00",
  "customer_rate": "2647.000000",
  "receiving_account_id": "uuid",
  "note": null
}
```

Backend: 1. validates customer/account 2. recalculates `expected_idr` 3.
creates order with payment `awaiting` 4. creates fulfillment `pending`
5. writes audit event

Response:

``` json
{
  "id": "uuid",
  "customer": {"id": "uuid", "display_name": "Customer Demo"},
  "cny_amount": "10000.00",
  "customer_rate": "2647.000000",
  "expected_idr": "26470000.00",
  "payment_status": "awaiting",
  "fulfillment_status": "pending",
  "ui_status": "awaiting_payment"
}
```

## GET `/orders`

Filters: - date/date range - customer - payment status - fulfillment
status - account - search

## GET `/orders/{order_id}`

Returns full order detail plus linked team movements and audit summary.

## PATCH `/orders/{order_id}`

Controlled correction of editable order fields. Material changes create
an audit event and backend recalculates dependent values.

## POST `/orders/{order_id}/receive-payment`

``` json
{
  "received_at": "2026-09-20T10:30:00+08:00"
}
```

Effects: - payment -\> `received` - Money In becomes recognized on
actual received date - audit event

## POST `/orders/{order_id}/mark-sent`

``` json
{
  "sent_at": "2026-09-20T10:45:00+08:00"
}
```

Effects: - fulfillment -\> `sent` - UI state normally becomes Completed
if payment is also received - unusual state combinations return warnings

------------------------------------------------------------------------

# Teams

## GET `/teams`

Master list.

## POST `/teams`

Create team with default fee rate.

## GET `/teams/{team_id}/ledger?date=2026-09-20`

Returns: - received CNY - distributed CNY - adjustments - remaining
CNY - movements

## POST `/team-movements`

``` json
{
  "team_id": "uuid",
  "business_date": "2026-09-20",
  "movement_type": "distributed",
  "cny_amount": "10000.00",
  "order_id": "uuid-or-null",
  "note": null
}
```

## POST `/team-activities`

Recommended MVP aggregate for actual daily handled volume and fee
posting.

``` json
{
  "team_id": "uuid",
  "business_date": "2026-09-20",
  "actual_cny_handled": "16000.00",
  "fee_rate": "2.000000"
}
```

Backend atomically: 1. calculates fee 2. stores team activity 3. creates
exactly one linked canonical `financial_outflow` 4. returns both
references

This resolves the open schema decision in favor of explicit daily team
activity.

------------------------------------------------------------------------

# ATM / Card Activity

## POST `/atm-activities`

``` json
{
  "account_id": "uuid-or-null",
  "business_date": "2026-09-20",
  "actual_cny_handled": "5600.00",
  "fee_rate": "1.700000",
  "note": null
}
```

Backend atomically calculates `9520.00` IDR and creates exactly one
canonical outflow.

## GET `/atm-activities`

Date/account filters.

------------------------------------------------------------------------

# Money Out

## POST `/outflows`

For manual outflows such as RMB purchase/exchange, exchange fee, or
other expense.

Example RMB purchase:

``` json
{
  "business_date": "2026-09-20",
  "category": "rmb_purchase",
  "description": "RMB purchase",
  "cny_amount": "42090.00",
  "rate_or_fee": "2618.450000"
}
```

Backend calculates IDR amount for categories with a defined formula.

Example other:

``` json
{
  "business_date": "2026-09-20",
  "category": "other",
  "description": "Operational expense",
  "amount_idr": "50000.00"
}
```

## POST `/outflows/{outflow_id}/void`

Voids rather than hard-deletes a posted financial outflow. Requires
reason.

------------------------------------------------------------------------

# Dashboard / Recap

## GET `/dashboard/daily?date=2026-09-20`

Response shape:

``` json
{
  "date": "2026-09-20",
  "customer_count": 17,
  "order_count": 17,
  "total_cny": "48250.00",
  "money_in_idr": "0.00",
  "money_out_idr": "0.00",
  "profit_idr": "0.00",
  "recorded_business_balance_idr": null,
  "orders": {
    "awaiting_payment": 2,
    "ready_to_send": 3,
    "completed": 12
  },
  "warnings": []
}
```

## GET `/recaps/daily?date=2026-09-20`

Detailed breakdown: - customer/order rows - Money In - Money Out by
category - profit - team balances - pending items - reconciliation
warnings

------------------------------------------------------------------------

# Audit

## GET `/audit/{entity_type}/{entity_id}`

Authorized audit history.

------------------------------------------------------------------------

# AI - Phase 2

## POST `/ai/extract-order`

Accepts uploaded screenshot/file reference.

Returns **draft only**:

``` json
{
  "draft": {
    "customer_text": "Gaby",
    "matched_customer_id": "uuid-or-null",
    "cny_amount": "10000.00",
    "customer_rate": "2647.000000"
  },
  "confidence": {
    "customer": 0.94,
    "cny_amount": 0.99,
    "customer_rate": 0.98
  },
  "warnings": []
}
```

This endpoint never creates an order.

The user confirms/corrects the draft, then Next.js calls the ordinary
`POST /orders`.

------------------------------------------------------------------------

# Required API tests

-   financial values rejected when invalid/non-decimal
-   default account must be active
-   order expected IDR is recalculated server-side
-   payment recognition uses received timestamp
-   team activity creates one and only one outflow
-   ATM activity creates one and only one outflow
-   idempotent retry does not duplicate record
-   voided outflow disappears from Money Out
-   AI extraction cannot post an order
