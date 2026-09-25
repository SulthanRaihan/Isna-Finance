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


No browser or hosted Supabase M3 acceptance was performed, as requested. Local
PGlite tests do not establish real JWT/RLS integration or multi-session production
concurrency. The migration must be applied once using M3_SETUP.md before live use.
Existing upstream Starlette test-client deprecation warnings remain.

## Limits and remaining work

No unresolved financial specification conflict. Technical retry behavior and
validation responses are documented in 16_M3_ORDERS.md. Request keys are scoped to
owner and operation; identical transitions are no-ops, differing confirmed times
are rejected. Frontend uncertain retries retain their request only within the
mounted form; after closing/reloading, inspect Orders before re-entry.

Read APIs currently return customer-name search results and prioritize customers
seen in the recent order window; comprehensive search uses the search input.
Order detail returns empty linked team movements until M4. Live activation,
responsive browser review and shared synthetic acceptance remain outstanding.
Next milestone M4 is team ledger/daily activity with exactly one canonical fee
outflow. It is not implemented here.
