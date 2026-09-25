# UX Information Architecture v1

## UX principle

The highest-value screen is not the dashboard; it is Quick Order. The
product succeeds when recording an order takes only a few seconds and
eliminates nightly re-entry.

## Primary navigation - mobile first

Recommended bottom navigation: - Home - Orders - `+` Quick Order -
Activity - More

### Home

Shows: - today selector - active/default receiving account - customer
count - total CNY - Money In - Money Out - Profit - Awaiting Payment -
Ready to Send - reconciliation warnings

### Quick Order

Optimized for one-hand/mobile entry: 1. Customer search/select 2. CNY
amount 3. Rate 4. Expected IDR auto-preview 5. Receiving account
prefilled from today's default 6. Save

After save, provide immediate actions: - Mark IDR Received - Mark RMB
Sent - Add another order

### Orders

Tabs/filters: - All - Awaiting Payment - Ready to Send - Completed

Order detail: - customer - CNY - rate - expected IDR - receiving
account - payment status/time - RMB fulfillment status/time - linked
team movement when available - audit/history

### Activity

One place for operational movements: - Team - ATM/Card - RMB
Purchase/Exchange - Other Expense

Avoid forcing users through accounting terminology when a familiar
operational label is clearer.

### Teams

Team card: - RMB received today - RMB distributed today - remaining
RMB - fee - movements

### Accounts

-   account list
-   masked identifiers
-   active/inactive
-   set today's active accounts
-   set default

### Customers

-   search
-   recent customers
-   add/edit minimal profile
-   order history

### Daily Recap

Designed as the Excel replacement: - date - customers - total CNY -
Money In - Money Out - Profit - category breakdown - team balances -
pending items - export can be added later

### More

-   Customers
-   Accounts
-   Teams
-   Settings
-   Audit/history
-   Sign out

## Key interaction rules

-   Prefill instead of retyping.
-   Search recurring customers.
-   Default today's receiving account.
-   Auto-calculate financial values.
-   Never hide a pending operational state.
-   Confirmation required for destructive/material financial edits.
-   Keep account identifiers masked unless explicitly needed.
-   Use plain business language rather than technical/accounting jargon.

## AI future entry point

Quick Order may later add: `Import from Chat Screenshot`

Flow: Screenshot -\> AI draft -\> field-level preview/confidence -\>
user corrects/confirms -\> same normal Create Order path.

There must not be a separate AI-only ledger path.

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
