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

### atm_card_activities

-   id
-   account_id nullable
-   business_date
-   actual_cny_handled
-   fee_rate_idr_per_cny
-   calculated_fee_idr
-   note nullable
-   created_by
-   created_at

### expenses

Generic Money Out record. - id - business_date - category -
description - cny_amount nullable - rate nullable - amount_idr -
related_team_id nullable - related_atm_activity_id nullable -
created_by - created_at - updated_at

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
`10_POSTGRES_SCHEMA.md`: Team/ATM domain records generate one linked
canonical `financial_outflows` record. Do not union domain fee amounts
into Money Out a second time.

Do not store the same expense independently in both places without a
unique linkage/constraint.
