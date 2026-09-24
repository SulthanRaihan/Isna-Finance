# M2 implementation report - 2026-09-23

## Status and scope

Master-data code is implemented. Hosted activation and end-to-end persistence
acceptance are pending the M2 Supabase migration. No M3 order or financial posting
features are present. No real customer/account data was added during development.

## Frozen decisions, documented before implementation

- Explicit initial business timezone: Asia/Jakarta, under user delegation. The
  database clock and timezone determine the business date; API configuration must
  match. Never infer it from the developer, server or browser timezone.
- A current/future daily assignment blocks soft account deactivation. API returns
  every conflicting date/default flag, and UI links to explicit resolution.
- No default changes as a deactivation side effect. Historical assignments remain
  unchanged. Inactive accounts cannot be newly assigned. New-order rejection is a
  documented M3 requirement; there is intentionally no order API yet.

No unresolved financial recognition conflict. Money In remains tied to the local
business date of idr_received_at, not orders.business_date.

## Created/changed files

- docs/01, 03, 04, 05, 06, 10, README: timezone and frozen deactivation rule;
  docs/15_M2_MASTER_DATA.md, M2_SETUP.md, M2_REPORT.md: contract and activation.
- api/app/core/business_time.py: timezone validation and aware timestamp conversion.
- api/app/schemas/master_data.py: strict inputs and decimal-string rate validation.
- api/app/repositories/master_data.py: caller-context Supabase reads/writes and
  sanitized error handling; api/app/api/master_data.py: protected master-data API.
- api/app/main.py: router and safe validation/error responses; requirements and
  pyproject: timezone data dependency for Windows; tests: timezone and M2 behaviors.
- supabase/migrations/202609230001_master_data.sql: tables, RLS, timezone setting,
  serialized deactivation check and atomic daily replacement RPC. SQL runner/tests
  in supabase/tests/ are reproducible with npm ci && npm test, without Docker.
- web/app/{customers,accounts,teams,daily-accounts,more}: protected screens;
  master-actions.ts and lib/master: server-side FastAPI integration; components:
  reusable forms, conflict resolution, daily editor, navigation and entry link.
- Frontend tests, environment examples, README and CI database-test job updated.
- M1_REPORT.md appended live owner login/session verification evidence.

## Verification

- 42 backend tests passed (including 7 timezone cases and 18 master-data cases).
- 26 frontend tests passed, including preservation of input on failure, explicit
  default resolution and conflict links with no automatic assignment write.
- Both migrations and the rollback-only master_data.sql test passed in a local
  PGlite PostgreSQL engine with synthetic auth fixtures. Verified current/future
  conflicts, history retention, atomic failed replacement, inactive rejection,
  no account hard deletion, and owner/developer/anonymous access boundaries.
- Frontend production build and browser service-role marker scan passed.
- Phone 390x844 and desktop 1280x800 navigation inspected; signed-in account form
  renders and reports unavailable data while the hosted migration is absent.
- SQL tests do not prove real Supabase JWT integration or multi-session production
  concurrency. The advisory transaction lock serializes account updates and daily
  replacement; hosted concurrency/integration verification is still required.
- Existing upstream Starlette test-client deprecation warnings remain. An elevated
  run also reported a local pytest cache permission warning; tests still passed.

## Commands and remaining work

See M2_SETUP.md for exact commands. Apply the M2 migration once to the development
project, then perform its synthetic live acceptance checklist. Do not run the empty-
database SQL test against the already provisioned live owner project. No database
migration or real account change was executed on the user's Supabase project.
Do not claim M2 live completion until persistence, conflicts and RLS are verified
there. M3 remains unimplemented.
