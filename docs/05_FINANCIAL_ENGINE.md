# Financial Engine Specification v1

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

## Purpose

This document defines the authoritative deterministic financial rules.
FastAPI is the source of truth for these calculations. The frontend may
show previews, but the backend must recalculate and validate all
persisted values.

## Numeric policy

-   CNY amounts: PostgreSQL `NUMERIC(18,2)`.
-   IDR amounts: PostgreSQL `NUMERIC(20,2)` for calculation/storage even
    if the current UI normally displays whole rupiah.
-   Rates/fees: PostgreSQL `NUMERIC(18,6)` to avoid premature rounding.
-   Python: `Decimal` only.
-   Never use binary `float` for financial calculations.
-   Default display: IDR with no decimal when the result is whole; CNY
    up to 2 decimals.
-   Persist the rate/fee actually used on each transaction so later
    settings changes do not rewrite history.

## F-01 Expected customer IDR

`expected_idr = cny_amount * customer_rate`

Example: - CNY: 10,000 - customer rate: 2,647 - expected IDR: 26,470,000

The backend recalculates this value. A client-provided result is never
authoritative.

## F-02 Money In

An order contributes to Money In only when payment status is `received`.

Use the actual payment recognition date:
`money_in_date = idr_received_at business-local date`

For v1: `order_money_in = expected_idr`

If future operations allow received IDR to differ from expected IDR, add
an `actual_idr_received` field through a specification change rather
than silently overloading the current field.

Daily:
`daily_money_in = SUM(order_money_in WHERE payment_status='received' AND money_in_date=selected_date)`

## F-03 Money Out: canonical posting model

Use **one canonical `financial_outflows` table** for all amounts
contributing to Money Out.

Operational records such as team activity or ATM/card activity may
create one linked posted outflow only on explicit payment. Corrections retain
voided ancestors and at most one posted replacement. They must not be summed
separately again in dashboard calculations.

Canonical categories: - `rmb_purchase` - `team_fee` - `atm_card_fee` -
`exchange_fee` - `other`

Daily:
`daily_money_out = SUM(financial_outflows.amount_idr WHERE business_date=selected_date AND status='posted')`

## F-04 Team fee

`team_fee_idr = actual_cny_handled * fee_rate_idr_per_cny`

The fee rate is snapshotted on the activity/outflow.

Example: - actual CNY handled: 16,000 - fee rate: 2 - fee: 32,000 IDR

## F-05 ATM/card fee

`atm_fee_idr = actual_cny_handled * fee_rate_idr_per_cny`

Example: - actual CNY handled: 5,600 - fee rate: 1.7 - fee: 9,520 IDR

Capacity is not used as the fee basis. Saving is unpaid; Money Out is recognized
only on explicit payment using the actual payment date.

## F-06 RMB purchase/exchange outflow

When the spreadsheet/business workflow records an RMB purchase/exchange:
`purchase_cost_idr = cny_amount * purchase_rate`

Store the CNY amount and purchase rate for traceability, but Money Out
uses the calculated/posting amount in IDR.

Exchange fees use the actual IDR amount entered by the user, without a CNY/rate formula.

## F-07 Daily Profit

Preserve spreadsheet v1 logic:

`daily_profit = daily_money_in - daily_money_out`

Do not add FIFO/LIFO/inventory valuation/unrealized-profit logic.

## F-08 Team RMB balance

Team RMB balance is operational/reconciliation data, not profit:

`team_balance_cny = SUM(received) - SUM(distributed) + SUM(adjustment_signed_amount)`

A team movement can optionally link to an order.

## F-09 Recorded Business Balance

This is not an actual bank balance.

For a selected date:
`recorded_business_balance = latest_opening_position_on_or_before_date + cumulative_money_in_after_opening - cumulative_money_out_after_opening`

UI must label it as recorded/business position and explain that it
reflects only records in the application.

## F-10 Dates

Store timestamps in UTC where appropriate and store/derive an explicit
business date for daily reporting. Business timezone is a configurable
application setting. Do not derive financial reporting dates from a
developer/server timezone.

## F-11 Corrections

- Posted outflows are never hard-deleted. Void requires a reason, preserves the
  original values and audit, and excludes the posting from Money Out. It is not a refund.
- Correction atomically voids the current posted record and inserts a replacement
  linked by replaces_id. A failure at any stage rolls back posting, audit and key.
- Applies to team_fee, atm_card_fee, rmb_purchase, exchange_fee and other. Preserve
  category/source identity and the full chain. Only the current posted row counts.
- Paid activity snapshots remain locked; corrected inputs and actual payment date
  are stored on the replacement. Void does not reset fee_status or permit repayment.
- Realized customer orders retain M3 locks. M5 does not correct customer orders.

## F-12 Idempotency / duplicate protection

Write endpoints that can be retried should support an idempotency key or
equivalent duplicate protection. AI imports must never create a second
order merely because a request is retried.

## Authoritative dashboard formulas

-   Customer count: distinct orders for the selected business date
    according to the product definition.
-   CNY volume: sum of order CNY for the selected business date.
-   Money In: F-02.
-   Money Out: F-03.
-   Profit: F-07.
-   Pending states: derived from order payment + fulfillment statuses.
-   Team balances: F-08.

## Minimum unit-test vectors

1.  `10000 * 2647 = 26470000`
2.  `5600 * 1.7 = 9520`
3.  `3000 * 1.7 = 5100`
4.  `16000 * 2 = 32000`
5.  Money In excludes an order whose IDR has not been received.
6.  Money In uses the business-local date of `idr_received_at`, not
    `orders.business_date` or `created_at`.
7.  Money Out excludes a voided outflow.
8.  Team/ATM linked activity contributes to Money Out exactly once.
9.  Profit equals canonical Money In minus canonical Money Out.
10. Team balance is independent from profit.

## Business timezone decision (2026-09-23)

The user delegated the timezone choice. The initial configured business timezone
is `Asia/Jakarta` (WIB, UTC+7), representing Indonesian operations. This is an
explicit product default, not inferred from the developer's or browser's timezone.
Set `BUSINESS_TIMEZONE` on the API to override it with a valid IANA timezone.
An invalid setting must fail visibly, never fall back to machine-local time.

Store event timestamps as UTC/offset-aware timestamps. Convert them to the
configured business timezone when deriving a business-local date. Explicit
`business_date` values remain calendar dates and are not shifted during conversion.
Money In still derives exclusively from `idr_received_at`, never the order date.
A business day rolls over at local midnight. Changing this setting after financial
records exist requires a deliberate reporting-impact review; it is not a casual
per-user display preference. M2 obtains today's date from the API so all
clients use the same date.

M2 stores the configured timezone in `private.business_settings` for database
enforcement. API `BUSINESS_TIMEZONE` must match; mismatches fail closed.
See `15_M2_MASTER_DATA.md` and `M2_SETUP.md` for configuration details.

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
