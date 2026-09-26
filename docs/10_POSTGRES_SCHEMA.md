# Physical PostgreSQL Schema v1

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

Target: Supabase PostgreSQL.

This is the implementation-oriented schema blueprint. Migrations should
be generated from this document only after review.

## Extensions / conventions

-   Primary keys: UUID.
-   `created_at` / `updated_at`: `timestamptz`.
-   Record dates: explicit `business_date date` with the semantics above;
    Money In instead derives its recognition date from `idr_received_at`.
-   Use `numeric`, never PostgreSQL floating-point types, for
    money/rates/CNY.
-   Foreign keys should normally restrict destructive deletion of
    referenced financial data.

## profiles

Linked 1:1 with Supabase Auth. - `id uuid PK` references
`auth.users(id)` - `display_name text` - `role text` check in
(`owner`,`operator`,`developer`) - `created_at timestamptz` -
`updated_at timestamptz`

## customers

-   `id uuid PK`
-   `display_name text NOT NULL`
-   `note text NULL`
-   `is_active boolean NOT NULL default true`
-   `created_at timestamptz NOT NULL`
-   `updated_at timestamptz NOT NULL`

Indexes: - normalized/searchable display name - active customers

## accounts

-   `id uuid PK`
-   `label text NOT NULL`
-   `bank_name text NOT NULL`
-   `country_code text NOT NULL`
-   `account_last4 text NULL`
-   `protected_account_number text NULL` only if truly needed and
    protected appropriately
-   `account_type text NULL`
-   `is_active boolean NOT NULL default true`
-   timestamps

Do not require full account numbers for MVP if label + last4 are
sufficient.

## daily_account_assignments

-   `id uuid PK`
-   `business_date date NOT NULL`
-   `account_id uuid NOT NULL FK accounts`
-   `is_default boolean NOT NULL default false`
-   `created_at timestamptz`

Constraints: - unique `(business_date, account_id)` - partial unique
index: one row with `is_default=true` per `business_date`

## orders

-   `id uuid PK`
-   `customer_id uuid NOT NULL FK customers`
-   `business_date date NOT NULL`
-   `cny_amount numeric(18,2) NOT NULL CHECK > 0`
-   `customer_rate numeric(18,6) NOT NULL CHECK > 0`
-   `expected_idr numeric(20,2) NOT NULL CHECK >= 0`
-   `receiving_account_id uuid NOT NULL FK accounts`
-   `payment_status text NOT NULL` check (`awaiting`,`received`)
-   `idr_received_at timestamptz NULL`
-   `fulfillment_status text NOT NULL` check (`pending`,`sent`)
-   `cny_sent_at timestamptz NULL`
-   `note text NULL`
-   `created_by uuid NOT NULL FK profiles`
-   `created_at timestamptz`
-   `updated_at timestamptz`

Consistency constraints/application validation: - payment `received`
requires `idr_received_at` - fulfillment `sent` requires `cny_sent_at` -
backend recalculates `expected_idr`

Indexes: - `business_date` - `customer_id` - payment/fulfillment
status - receiving account

## teams

-   `id uuid PK`
-   `name text NOT NULL UNIQUE`
-   `default_fee_rate numeric(18,6) NOT NULL default 2`
-   `is_active boolean NOT NULL default true`
-   timestamps

## team_movements

-   `id uuid PK`
-   `team_id uuid NOT NULL FK teams`
-   `business_date date NOT NULL`
-   `movement_type text NOT NULL` check
    (`received`,`distributed`,`adjustment`)
-   `cny_amount numeric(18,2) NOT NULL`
-   `order_id uuid NULL FK orders`
-   `note text NULL`
-   `created_by uuid NOT NULL FK profiles`
-   `created_at timestamptz`

Rules: - received/distributed amount is positive; direction comes from
type. - adjustment semantics must be explicit in service layer (signed
amount or an additional direction field before implementation). - order
link is optional.

## atm_card_activities

-   `id uuid PK`
-   `account_id uuid NULL FK accounts`
-   `business_date date NOT NULL`
-   `actual_cny_handled numeric(18,2) NOT NULL CHECK > 0`
-   `fee_rate numeric(18,6) NOT NULL CHECK >= 0`
-   `calculated_fee_idr numeric(20,2) NOT NULL`
-   `note text NULL`
-   `created_by uuid NOT NULL FK profiles`
-   timestamps

Backend recalculates fee.

## financial_outflows

Canonical Money Out table. - `id uuid PK` -
`business_date date NOT NULL` - `category text NOT NULL` check
(`rmb_purchase`,`team_fee`,`atm_card_fee`,`exchange_fee`,`other`) -
`description text NOT NULL` -
`amount_idr numeric(20,2) NOT NULL CHECK >= 0` -
`cny_amount numeric(18,2) NULL` - `rate_or_fee numeric(18,6) NULL` -
`source_type text NULL` - `source_id uuid NULL` -
`status text NOT NULL default 'posted'` check (`posted`,`voided`) -
`created_by uuid NOT NULL FK profiles` - timestamps

Canonical-link rule: - A source operational record may have at most one
posted canonical outflow. - Implement uniqueness around
`(source_type, source_id)` when source is present. - Dashboard Money Out
sums this table only.

Examples: - team fee source -\> source_type `team_daily_activity` - ATM fee
source -\> source_type `atm_card_activity` - manually entered RMB
purchase/exchange/other may have no separate source record.

## business_balance_openings

-   `id uuid PK`
-   `effective_date date NOT NULL UNIQUE`
-   `opening_amount_idr numeric(20,2) NOT NULL`
-   `note text NULL`
-   `created_by uuid NOT NULL FK profiles`
-   `created_at timestamptz`

## audit_logs

Append-only application audit log. - `id uuid PK` -
`actor_user_id uuid NOT NULL FK profiles` -
`entity_type text NOT NULL` - `entity_id uuid NOT NULL` -
`action text NOT NULL` - `before_json jsonb NULL` -
`after_json jsonb NULL` - `created_at timestamptz NOT NULL`

Indexes: - `(entity_type, entity_id, created_at)` - actor/date when
useful

## idempotency_keys

Recommended for retriable writes and AI import confirmation. -
`id uuid PK` - `user_id uuid NOT NULL FK profiles` -
`key text NOT NULL` - `operation text NOT NULL` -
`resource_id uuid NULL` - `created_at timestamptz` - unique
`(user_id, key, operation)`

## Views / queries

Prefer derived views/queries instead of a manually maintained summary
table: - `daily_order_metrics` - `daily_money_in` - `daily_money_out` -
`daily_profit` - `team_balances`

Exact SQL belongs in migrations after API semantics are finalized.

## RLS direction

Before production: - authenticated owner/operator may access only
permitted business rows - developer role must not automatically imply
production financial-data access - audit logs should be read-limited and
append-controlled - service-role credentials must never reach the
browser

## ERD

``` text
auth.users
   |
   1
profiles
   |
   +--------------------------+
   |                          |
customers 1 ---- N orders ----1 accounts
                     |             |
                     |             +---- N daily_account_assignments
                     |
                     +---- optional link from team_movements

teams 1 -------- N team_movements

accounts 1 ----- N atm_card_activities
                         |
                         | exactly one canonical fee posting
                         v
                  financial_outflows

team fee activity ------> financial_outflows
manual purchase/fee ----> financial_outflows

business_balance_openings
audit_logs
idempotency_keys
```

## team_daily_activities - decision frozen for MVP

Use an explicit daily activity record rather than deriving fee volume from
movements. This frozen decision supersedes the earlier open implementation detail.

-   `id uuid PK`
-   `team_id uuid NOT NULL FK teams`
-   `business_date date NOT NULL`
-   `actual_cny_handled numeric(18,2) NOT NULL CHECK > 0`
-   `fee_rate numeric(18,6) NOT NULL CHECK >= 0`
-   `calculated_fee_idr numeric(20,2) NOT NULL`
-   `fee_status text NOT NULL default unpaid` check (`unpaid`,`paid`)
-   `payment_date date NULL` (required iff paid)
-   `created_by uuid NOT NULL FK profiles`
-   timestamps
-   unique `(team_id, business_date)` for MVP unless multiple daily
    sessions are later required

Saving this record calculates the fee as unpaid without creating an outflow.
Explicit fee payment creates the single canonical outflow; see the M4 rule below.

Team movements remain the reconciliation ledger and do not independently
create team-fee outflows.

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

M3's idempotency_keys additionally stores non-null request_json and response_json
(jsonb) for payload conflict detection and exact replay. resource_id references
orders with ON DELETE RESTRICT. Financial values inside audit/replay JSON are
encoded as decimal strings. Direct authenticated writes to orders, audit_logs and
idempotency_keys are revoked; checked RPCs perform atomic mutations.

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
