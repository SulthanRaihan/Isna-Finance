# Data Model / ERD v1

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

This is a logical schema. Exact SQL types, indexes, constraints, and RLS
policies will be finalized before implementation.

The physical blueprint in `10_POSTGRES_SCHEMA.md` and canonical posting model
in `05_FINANCIAL_ENGINE.md` refine this earlier logical model: `profiles` is
the identity table, `financial_outflows` is the canonical Money Out table,
and `team_daily_activities` owns daily team fee posting. The historical
`users` / `expenses` labels below are conceptual, not additional SQL tables.

## Core entities

### users

Application identity/profile linked to Supabase Auth. - id -
auth_user_id - display_name - role - created_at - updated_at

### customers

Minimal recurring customer master. - id - display_name - note nullable -
is_active - created_at - updated_at

### accounts

Indonesian/Chinese account master. - id - owner_label - bank_name -
country - account_number_encrypted_or_protected nullable - account_last4
nullable - account_type - is_active - created_at - updated_at

### daily_account_assignments

Which accounts are active for a business date. - id - business_date -
account_id - is_default - created_at

Constraint: only one default assignment per business date.

### orders

Customer CNY order. - id - customer_id - business_date - cny_amount -
customer_rate - expected_idr - receiving_account_id - payment_status -
idr_received_at nullable - fulfillment_status - cny_sent_at nullable -
note nullable - created_by - created_at - updated_at

`expected_idr` must be validated/recalculated by the financial engine.

### teams

-   id
-   name
-   default_fee_rate_idr_per_cny
-   is_active
-   created_at
-   updated_at

### team_movements

RMB ledger movements. - id - team_id - movement_type (`received`,
`distributed`, `adjustment`) - cny_amount - order_id nullable -
business_date - note nullable - created_by - created_at

### team_daily_activities

id, team_id, business_date (activity date), actual_cny_handled, fee_rate,
calculated_fee_idr, fee_status (unpaid/paid), payment_date nullable, created_by,
created_at, updated_at. Unique team/date. Outflow exists only after fee payment.

### atm_card_activities

-   id
-   account_id nullable
-   business_date
-   actual_cny_handled
-   fee_rate
-   calculated_fee_idr
-   fee_status unpaid/paid
-   payment_date nullable (actual fee payment date)
-   note nullable
-   created_by
-   created_at

### financial_outflows

Canonical Money Out record. - id - business_date - category -
description - cny_amount nullable - rate_or_fee nullable - amount_idr -
source_type/source_id nullable - status posted/voided - replaces_id nullable unique -
void_reason/voided_at nullable - created_by - created_at - updated_at

Important: implementation must prevent double-counting if team/ATM
activities also create expense records. Prefer one canonical financial
posting model.

### business_balance_openings

Opening position for a period/date when Recorded Business Balance is
used. - id - effective_date - opening_amount_idr - note nullable -
created_by - created_at

### audit_logs

-   id
-   actor_user_id
-   entity_type
-   entity_id
-   action
-   before_json nullable
-   after_json nullable
-   created_at

## Derived data

Do not create a manually editable `daily_summary` table unless
performance later requires it. Prefer SQL views/queries for: - daily
customer count - daily CNY volume - Money In - Money Out - Daily
Profit - pending orders - team balances

## Relationship sketch

``` text
CUSTOMER 1 ───────< ORDERS >────── 1 ACCOUNT
                        |
                        | optional reference
                        v
TEAM 1 ───────< TEAM_MOVEMENTS

ACCOUNT 1 ─────< DAILY_ACCOUNT_ASSIGNMENTS

ACCOUNT 1 ─────< ATM_CARD_ACTIVITIES

TEAM / ATM ACTIVITY ───> EXPENSE / FINANCIAL POSTING

USERS ─────> created_by / audit events
```

## Critical schema decision before SQL migration

The decision is frozen in `05_FINANCIAL_ENGINE.md` and
`10_POSTGRES_SCHEMA.md`: Team activity generates one linked canonical
`financial_outflows` record only on explicit fee payment. ATM follows the same explicit-payment rule in M5. Do not union domain fee amounts
into Money Out a second time.

Do not store the same expense independently in both places without a
unique linkage/constraint.

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
