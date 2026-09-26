# Business Rules v1

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

## BR-01 - Order calculation

For a customer order:

`expected_idr = cny_amount * customer_rate`

The application calculates this value. The user should not need to
calculate it manually.

## BR-02 - Payment recognition

Money In is recognized when IDR is actually confirmed as received, using
the actual received date.

Payment state is separate from RMB fulfillment state.

Suggested payment states: - `awaiting` - `received`

## BR-03 - Fulfillment

An order is operationally complete when RMB/CNY has been sent to the
customer.

Suggested fulfillment states: - `pending` - `sent`

Derived UI state: - payment awaiting + RMB pending -\> Awaiting
Payment - payment received + RMB pending -\> Ready to Send - payment
received + RMB sent -\> Completed - unusual combinations should be
surfaced as warnings rather than silently normalized

## BR-04 - Money Out recognition

Money Out follows the date the financial outflow actually occurs, not
necessarily the customer order date.

## BR-05 - Daily profit

For v1, preserve Isna's spreadsheet logic:

`daily_profit = total_money_in - total_money_out`

Do not introduce FIFO, LIFO, unrealized profit, inventory valuation, or
per-customer buy-vs-sell profit unless the business specification is
intentionally changed later.

## BR-06 - Receiving accounts

-   Accounts are master data.
-   A day may have multiple active receiving accounts.
-   At most one account is the default receiving account at a time.
-   New orders default to that account but can be overridden.
-   Account numbers should be masked in normal UI.

## BR-07 - Team fee

Team fee is based on actual RMB handled:

`team_fee_idr = actual_cny_handled * team_fee_rate`

Current known default: Rp2 per CNY. This must be configurable, not
hardcoded.

## BR-08 - ATM/card fee

ATM/card fee is based on actual RMB handled, not maximum capacity:

`atm_fee_idr = actual_cny_handled * atm_fee_rate`

Current known default: Rp1.7 per CNY. This must be configurable, not
hardcoded.

## BR-09 - Team RMB ledger

A team ledger records RMB received and distributed.

`team_rmb_balance = total_received - total_distributed`

A distribution may optionally reference a customer order. The link is
useful for reconciliation but must not be mandatory for every movement.

## BR-10 - Outflow categories

The system must support at least: - RMB purchase/exchange - Team fee -
ATM/card fee - Exchange fee - Other operational expense

Categorization improves structure but must preserve the spreadsheet's
overall Money Out logic.

## BR-11 - Recorded business balance

Do not label the application's calculated position as the user's actual
bank balance.

Use the concept:

`recorded_business_balance = opening_business_position + recorded_cash_in - recorded_cash_out`

The UI must explain that this is based only on transactions recorded in
the application.

## BR-12 - Auditability

Financial records must not change silently. Material edits should
preserve who/when/what changed. Avoid destructive hard deletion of
financial records.

## BR-13 - Financial arithmetic

-   Backend financial calculations are deterministic.
-   Use Python `Decimal`.
-   Use PostgreSQL `NUMERIC/DECIMAL`.
-   Never use LLM-generated arithmetic as the source of truth.
-   Avoid binary floating-point values for money/rates/fees.

## BR-14 - AI safety boundary

AI may: - extract fields from chat screenshots - propose customer
matches - create transaction drafts - flag possible
duplicates/anomalies - explain deterministic results

AI must not: - silently create/post financial ledger entries - silently
alter confirmed transactions - calculate authoritative profit/balance
independently of the financial engine

## BR-15 - Privacy

Development and testing use synthetic data. Real customer names, full
account numbers, personal balances, and real screenshots should not be
committed to source control.

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
