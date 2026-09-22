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
