# M6 Dashboard and Daily Recap


## M6 frozen reporting rules (2026-09-27)

- customer_count = distinct customer_id among orders whose business_date equals
  selected_date; order_count counts those orders separately. CNY volume sums them.
- Needs Attention includes orders with business_date <= selected_date that are
  incomplete according to CURRENT payment/fulfillment status. Include unresolved
  prior dates. No historical point-in-time status reconstruction is provided.
- An opening is the balance at the START of effective_date, before that day's
  transactions. Select the latest opening <= selected_date; add received Money In
  and subtract posted Money Out from effective_date through selected_date INCLUSIVE.
  Without an applicable opening return status=not_configured and amount=null;
  never assume zero. This is recorded business position, not actual bank balance.
- Reconciliation conditions are informational: sent RMB with awaiting payment,
  and non-zero cumulative team RMB balances through selected_date. They are not
  automatic errors and do not change financial recognition or order status.
- Money In continues to use the business-local date of idr_received_at only.
  Money Out uses posted canonical financial_outflows.business_date only; unpaid
  activity fees and voided ancestors never contribute. Profit = Money In - Money Out.



## API and implementation contract

Owner-only GET /api/v1/dashboard/daily?date=YYYY-MM-DD and
GET /api/v1/recaps/daily?date=YYYY-MM-DD&section=orders&limit=20&offset=0.
Date is required at the API. Pages obtain default date from business-context.
Recap section: orders, money_in, outflows, pending, teams. Limits 1..100, offset>=0.
Dashboard includes five recent selected-day orders; recap paginates one selected
section. Totals always aggregate ALL qualifying rows, never the current page.

Both routes share one STABLE, owner-checked read-only database RPC snapshot.
Responses contain date, timezone, customer_count, order_count, total_cny,
money_in_idr, money_out_idr, profit_idr, recorded_business_balance_idr (nullable),
business_position {status: configured/not_configured, opening, amount_idr},
orders {awaiting_payment, ready_to_send, sent_awaiting_payment, completed},
pending_count, category_breakdown (all five categories, including zeros),
warnings, receiving_accounts and page {section, items, total, limit, offset}.
All financial JSON values are exact decimal strings. Errors never become zeros.

Awaiting_payment includes ALL awaiting payments (including sent RMB);
ready_to_send means received+pending. These two counts are disjoint and sum to
pending_count, with the approved current-status/date cutoff. sent_awaiting_payment
is the warning subset, not an additional count. Completed counts received+sent
orders for the selected order date and is labelled separately.
Warnings include informational counts and links to pending/team recap sections.
Team balances include all teams, even inactive ones, with movements <= selected
calendar date; received-distributed+signed adjustments. Nonzero count covers all
teams irrespective of pagination. No implicit profit or fee from movements.

Selected-day order rows include customer name and masked receiving account.
Money In rows use payment recognition date even if order date differs. Outflow
rows include posted originals/replacements only. Pending rows show current status
and original order date, with an explicit no-historical-status disclaimer.
Receiving accounts show existing selected-day assignments; reporting changes none.

## Opening scope

Create the specified business_balance_openings table with owner SELECT and forced
RLS. Reporting consumes existing configured openings; it does not invent a zero
opening or create one automatically. No opening write/edit UI or API is introduced
in M6 (no such workflow is specified). Provisioning remains a deliberate database
administration action; never seed real amounts. Negative recorded positions and
opening amounts are represented as signed numeric, as in the schema blueprint.

## Tests specified before implementation

Two orders for one customer => customer_count=1, order_count=2. Selected-day volume
is independent from received date. Asia/Jakarta midnight boundaries determine
Money In. Voided outflows and unpaid fees excluded. Current pending includes older
unresolved records and excludes future order dates and now-completed orders.
Latest opening wins, same-day transactions included, future openings ignored,
missing opening returns not_configured/null. Team signed movements include prior
dates, exclude future dates, and nonzero warnings remain informational. Totals
must not shrink when page limit=1. Owner allowed; anonymous/developer denied.
No report endpoint writes data. M7 and later are outside this change.
