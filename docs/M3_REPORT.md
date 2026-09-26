# M3 implementation report - 2026-09-25

## Scope and decisions

M3 manual orders implemented: Quick Order, customer search/add, daily default and
explicit assigned-account override, list/filter/detail, controlled edits,
independent payment/RMB confirmation, append-only audit and idempotent creates.

The user's three rules were documented in 01/03/04/05/06/10/11 and the new
16_M3_ORDERS.md before code changes: ROUND_HALF_UP to two decimals, all five
material fields locked after either realization event, and active plus assigned
receiving accounts. Money In remains based only on the business-local date of
idr_received_at. No recognized amount override, partial payment, reverse status,
void, team posting, outflow, dashboard aggregation or AI was introduced.

## Files

- api/app/schemas/orders.py: strict decimal-string and aware-timestamp inputs.
- api/app/services/orders.py: high-precision Decimal rounding and derived statuses/
  Money In date. api/app/api/orders.py: authenticated routes, filters and mutation
  orchestration. main.py and repository error mapping extended.
- supabase/migrations/202609250001_orders.sql: orders, audit_logs, idempotency_keys,
  RLS, restricted table privileges and atomic checked mutation RPC. Account checks
  share M2's lock. SQL checks independently defend financial invariants.
- web/app/orders/, order-actions.ts, components/order-editor.tsx and
  order-transitions.tsx, lib/orders/: screens and server-only integration.
  Navigation/Home now expose M3. API transport forwards idempotency keys.
- Backend, frontend and SQL regression tests; local SQL runner updated.
- README, specification updates, M3_SETUP.md and this report.

## Verification

Automated synthetic validation covers decimal/rounding/overflow, owner denial,
received-date recognition, independent states, field locks, stale writes, assigned
active accounts, audit atomicity, retries without duplicate records, literal
search filters and preserving inputs after failures.

- 76 backend tests passed; Ruff lint and formatting checks passed.
- 44 frontend tests passed; TypeScript, ESLint and Prettier checks passed.
- Production build and browser service-role/canary scan passed.
- All three migrations and both M2/M3 SQL test scripts passed in PGlite.
- Git diff whitespace check passed. No new environment variables or dependencies.


Browser acceptance was deferred at the implementation commit. Hosted acceptance
has now started as recorded below. PGlite alone does not establish hosted RLS or
multi-session concurrency behavior.
Existing upstream Starlette test-client deprecation warnings remain.

## Limits and remaining work

No unresolved financial specification conflict. Technical retry behavior and
validation responses are documented in 16_M3_ORDERS.md. Request keys are scoped to
owner and operation; identical transitions are no-ops, differing confirmed times
are rejected. Frontend uncertain retries retain their request only within the
mounted form; after closing/reloading, inspect Orders before re-entry.

Read APIs currently return customer-name search results and prioritize customers
seen in the recent order window; comprehensive search uses the search input.
Order detail returns empty linked team movements until M4. Responsive browser
review and remaining shared synthetic acceptance checks are outstanding.
Next milestone M4 is team ledger/daily activity with exactly one canonical fee
outflow. It is not implemented here.

## Hosted synthetic acceptance - 2026-09-26

The user reported applying M3 SQL. The local application used the existing owner
session against the development Supabase project:

- Owner order reads succeeded; anonymous order access returned 401.
- Synthetic account B was explicitly assigned as default for 2026-09-25 through
  M2. Quick Order preselected it without changing assignments itself.
- Created one synthetic order: `983f6f34-fc35-49b6-9f71-38d60959c2e1`.
  CNY 1 at rate 100.005 persisted as IDR 100.01. Creation audit was visible.
- Edited CNY to 2 while awaiting/pending. PATCH returned 200, detail showed
  IDR 200.01 and an additional update audit. No duplicate order was created.
- Automated datetime entry did not populate the submitted timestamp correctly;
  receipt returned 422. The embedded browser then crashed during native date-field
  interaction. Detail was reopened for shared testing. Receipt, sent state and
  post-realization edits are NOT verified live.

Resume from this same synthetic order. Outstanding hosted checks: receipt date
across midnight, note edits/field locks, sent-before-paid/completed states,
explicit account override, list filters, uncertain retry, developer/direct-table
RLS denial and concurrent writes. Automated coverage above is not a substitute
for these hosted checks. No financial rules or application code changed this run.
