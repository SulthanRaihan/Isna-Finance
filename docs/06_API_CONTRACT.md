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

Backend calculates the fee and stores an unpaid team activity without an
outflow. POST /team-activities/{id}/pay explicitly confirms actual payment_date
and atomically creates one linked canonical outflow; see the M4 rule below.

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

Backend calculates `9520.00` IDR and saves unpaid activity without an outflow.
Explicit payment creates its canonical outflow on the actual payment date.

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

Backend calculates RMB purchase IDR as CNY * purchase rate with HALF_UP rounding.
Exchange fee and other expense accept actual amount_idr only. Manual requests
cannot create team_fee or atm_card_fee.

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

Requires `reason`, `updated_at`, and Idempotency-Key. Voids the posted record,
preserves audit, and excludes it from Money Out. Does not represent a refund.

## POST `/outflows/{outflow_id}/correct`

Requires Idempotency-Key and a flat body containing `reason`, `updated_at`,
`business_date`, `description`, and either `cny_amount`/`rate_or_fee` for purchase
or fee categories, or `amount_idr` for exchange_fee/other. Category and source
remain those of the original. Atomically void the current posting and create a
linked replacement; rollback all on failure. Response is the new posting.

GET `/outflows` defaults to status=posted; optional date/category/status/source
filters with limit/offset. GET `/outflows/{id}` returns outflow, full chain, audit.
ATM PATCH uses create fields plus updated_at and is only allowed while unpaid.
POST `/atm-activities/{id}/pay` requires payment_date, updated_at, Idempotency-Key.
See `18_M5_MONEY_OUT.md` for complete M5 contract.

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
-   explicit team fee payment creates one and only one outflow; unpaid activity creates none
-   explicit ATM fee payment creates one canonical outflow; unpaid activity creates none
-   idempotent retry does not duplicate record
-   voided outflow disappears from Money Out
-   AI extraction cannot post an order

## M1 owner-only implementation

See `14_M1_AUTH.md` for the approved email/password, single-owner access rules,
profile provisioning, initial RLS, and `/api/v1/me` contract.

Business timezone: initial explicit default `Asia/Jakarta`; see the dated timezone
decision in `05_FINANCIAL_ENGINE.md`. Do not use device-local dates.

## M2 account deactivation rule (approved 2026-09-23)

- Deactivation is soft (`is_active=false`); no hard-delete endpoint is permitted.
- Reject deactivation if ANY `daily_account_assignments` row references the account
  on today's or a future business date, using the configured business timezone.
- Return all conflicting assignments, including their business date and default
  status. The UI asks the user to explicitly remove/change those daily assignments.
- Never automatically select, clear, or change a default account as a side effect
  of account deactivation. Assignment replacement remains a separate explicit action.
- Historical assignments and transactions remain unchanged.
- An inactive account is not selectable for new assignments or new orders.
- Deactivation is allowed after all current/future references are removed/changed.
- Protect the check and update atomically, including concurrent assignment changes.

`PATCH /accounts/{account_id}` requesting `is_active=false` returns HTTP 409:
```json
{"error":{"code":"ACCOUNT_ASSIGNED","message":"Resolve current/future assignments before deactivating this account.","fields":{"conflicting_assignments":[{"business_date":"2026-09-23","account_id":"synthetic-uuid","is_default":true}]}}}
```
No writes occur on conflict. A daily-account replacement is atomic. An empty
active list with a null default explicitly clears that date; the default, if
present, must belong to the selected active accounts. No implicit carry-forward.

## M3 frozen order rules (2026-09-25)

- Authoritative persisted IDR calculations use Python Decimal, ROUND_HALF_UP,
  quantized to two decimal places (100.005 becomes 100.01). Frontend values are
  previews only. Money In still uses the business-local date of idr_received_at.
- customer_id, business_date, cny_amount, customer_rate and receiving_account_id
  can change only while payment_status=awaiting AND fulfillment_status=pending.
  Either received payment OR sent RMB locks all five fields. note remains editable.
  All permitted changes are audited. Realized corrections require a future explicit
  correction/void workflow; M3 never silently changes financial history.
- An order account must be active AND assigned in daily_account_assignments for
  the order business_date. The daily default is only a preselection; an explicit
  override may choose another assigned active account. Order creation never
  creates or changes daily assignments.

M3 implementation details and error behavior: see 16_M3_ORDERS.md.

## M4 fee payment rule (approved 2026-09-26)

Activity business_date is the date the team activity occurred. Saving calculates
fee with Decimal ROUND_HALF_UP to two places and starts fee_status=unpaid; it
creates no financial_outflow and recognizes no Money Out. Explicit payment
confirmation supplies payment_date (the actual date money left). Payment atomically
marks the activity paid and creates exactly one canonical financial_outflows row:
category=team_fee, source_type=team_daily_activity, source_id=activity.id,
business_date=payment_date. Only this posted outflow contributes to Money Out.
Payment is idempotent and concurrent calls cannot create duplicate postings.
Once paid, team_id, business_date, actual_cny_handled and fee_rate are locked.
Later corrections require an explicit correction/void workflow, outside M4.
See 17_M4_TEAM_ACTIVITY.md for the implementation contract.

## M5 frozen rules (2026-09-26)

ATM/card activity saves a calculated fee with fee_status=unpaid and no Money Out.
Explicit fee payment supplies the actual payment_date and atomically creates one
canonical atm_card_fee outflow on that date. Payment is idempotent.
Void requires a reason, retains the original record/audit, changes status to
voided and excludes that record from Money Out. Void is accounting invalidation,
not a real-world refund. Correction atomically voids the old posting and creates
a linked replacement, preserving the full chain and audit; any failure rolls back
all changes. Only the current posted replacement contributes to Money Out.
Applies to team fees, ATM/card fees, RMB purchases, exchange fees and other manual
outflows. M3 realized orders stay locked; no order correction is introduced.
Exchange fee uses actual user-entered IDR. Only RMB purchase uses CNY * rate.
See 18_M5_MONEY_OUT.md for schema/API and verification details.
