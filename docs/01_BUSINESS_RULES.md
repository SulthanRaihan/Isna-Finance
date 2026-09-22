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
