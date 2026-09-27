# M6 implementation report — 2026-09-27

## Scope and outcome

M6 only: real Home dashboard and /recaps with selected-date order/customer/CNY
metrics, Money In, posted-only Money Out by category, profit, current pending
through the selected date, cumulative team balances, informational warnings,
assigned receiving accounts and opening-based recorded business position.
The placeholder home was replaced. Existing write actions invalidate Home/recap
so operational updates do not deliberately leave stale report pages cached.
No changes to financial recognition, M3 locks, M5 correction/void, or actual money
transfers. M7 and later were not implemented.

Four user-frozen rules were recorded in financial engine, API, wireframes and
related documents before code. API and SQL regression tests were written first.
One owner-checked STABLE SQL RPC supplies a consistent read snapshot through
FastAPI. Summary totals cover all qualifying records independently of paginated
lists. Financial JSON uses exact decimal strings; frontend only formats them.

## Verification

- 127 API tests passed. Ruff lint and formatting passed.
- 59 frontend tests passed. ESLint, TypeScript and Prettier passed.
- Production Next.js build passed, including / and /recaps.
- Client build service-role/canary scan passed.
- All six migrations and M2-M6 regression suites passed in disposable PGlite.
- Reporting tests cover distinct customers versus orders, received-date versus
  order-date recognition, both WIB midnight boundaries, signed team adjustments,
  current older pending/future exclusion, now-completed orders, unpaid ATM fee
  exclusion, voided posting exclusion, and replacement-only correction totals.
- Latest opening is selected; same-day flows are included; future opening ignored;
  no applicable opening returns not_configured/null. Pagination preserves totals.
- Owner report access succeeds; anonymous/developer calls and developer opening
  reads are denied. Application writes to openings are denied.
- UI tests verify not-configured state, exact large signed values, current-status
  disclaimer, informational warning links, recognition-date labels and unavailable
  service not becoming a false zero dashboard.
- Existing Starlette/httpx and AnyIO deprecation warnings remain. No dependency
  changes were introduced.

No M6 migration or browser acceptance was performed against hosted Supabase in
this implementation. Existing M5 synthetic data was not modified. Local SQL tests
use synthetic disposable data only; they do not prove hosted concurrency/RLS.

## Decisions, assumptions and limitations

No unresolved financial specification conflicts remain after the four user
clarifications. Pending counts overlap selected-date daily metrics only as clearly
labelled: pending uses current state and order date <= selected date; completed
count uses current state among selected-date orders. Sent/awaiting is a subset of
awaiting, not an additional pending total.

The schema includes owner-readable business_balance_openings, as specified, but
no opening is seeded and no unspecified opening write/edit workflow is added.
Reporting consumes deliberately provisioned openings. With none, the product
correctly remains not_configured. This is recorded position, never actual bank
balance. A future opening management workflow must be explicitly specified.

## Activation and commands

Follow [M6 setup](M6_SETUP.md). Apply only 202609270002_reporting.sql after M1-M5
with RLS enabled, restart FastAPI to 0.6.0 and restart Next.js. No new environment
variables, service-role key or Docker. The setup document lists all local checks
and the shared synthetic acceptance cases, including existing M3-M5 fixtures.

## Files created

- `api/app/api/reporting.py`
- `api/tests/test_reporting.py`
- `docs/19_M6_REPORTING.md`
- `docs/M6_SETUP.md`
- `supabase/migrations/202609270002_reporting.sql`
- `supabase/tests/reporting.sql`
- `web/app/loading.tsx`
- `web/app/recaps/loading.tsx`
- `web/app/recaps/page.tsx`
- `web/components/report-screen.tsx`
- `web/components/reporting.tsx`
- `web/lib/reporting.ts`
- `web/tests/report-screen.test.tsx`
- `web/tests/reporting.test.tsx`
- `docs/M6_REPORT.md` (this report)

## Files changed or removed

- `README.md`
- `api/app/main.py`
- `api/tests/test_health.py`
- `docs/01_BUSINESS_RULES.md`
- `docs/03_DATA_MODEL.md`
- `docs/05_FINANCIAL_ENGINE.md`
- `docs/06_API_CONTRACT.md`
- `docs/10_POSTGRES_SCHEMA.md`
- `docs/11_WIREFRAMES.md`
- `docs/README.md`
- `supabase/README.md`
- `supabase/tests/run-local.mjs`
- `web/app/master-actions.ts`
- `web/app/money-out-actions.ts`
- `web/app/more/page.tsx`
- `web/app/order-actions.ts`
- `web/app/page.tsx`
- `web/app/team-actions.ts`
- `web/components/app-shell.tsx`
- `web/components/workspace-home.tsx`
- `web/tests/shell.test.tsx`

## Remaining

Hosted migration and shared synthetic acceptance for M6. M5 broader hosted
acceptance items remain documented separately. M7 security hardening is the next
milestone only after authorization; no later work is included in this commit.
