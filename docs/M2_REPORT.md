# M2 implementation report - 2026-09-23

## Status and scope

Master-data code is implemented and the user has applied the hosted migration.
Core owner workflows passed live synthetic acceptance on 2026-09-25. No M3 order
or financial posting features are present. No real customer/account data was added.

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

## Live acceptance - 2026-09-25

- Owner created, searched and edited a synthetic customer, created two masked
  accounts, and created a team with exact rate 1.700001.
- Daily choices persisted across refresh. On September 25 (Asia/Jakarta), account
  A was selected on September 25 and 26. Deactivation returned HTTP 409 and both
  conflicting dates; account A stayed active. No default was silently assigned.
- Both dates were explicitly cleared via the UI (HTTP 200). Deactivation then
  returned HTTP 200 and account A displayed Nonaktif.
- September 24 still contained both accounts and retained A as its historical
  default. New choices for September 27 excluded A and kept no default.
- All five protected M2 GET endpoints returned HTTP 401 without a bearer token.
  Direct anonymous Supabase table probes returned 401/42501. This establishes
  denial, not an independent inspection of hosted RLS flags or every role policy.
- Intermittent upstream unavailability was observed; explicit retries succeeded.
  A recoverable owner-check failure previously redirected a submitting form away
  from its inputs. Server actions now return an inline error and make no API call
  unless owner verification succeeds. No automatic mutation retries were added.
- After that fix: 31 frontend tests, lint, typecheck, formatting, production build
  and client-secret scan passed. Five new regression cases cover both mutations,
  denied/unavailable access, client initialization failure and explicit retry.
  The 42 backend tests and isolated SQL checks listed above are prior-run evidence;
  their code was unchanged by this follow-up.

## Retained synthetic records

Names start with `Uji M2 20260924`: one customer, accounts A/B and one team.
A is inactive; B, the customer and team remain active test fixtures. September 24
historical choices are retained; September 25 and 26 choices are empty. No rows
were hard-deleted and no real money/order records were created.

## Commands and remaining work

See M2_SETUP.md for run commands. Do not rerun the migration or execute the
empty-database SQL test on the provisioned project. No extra environment changes
or service-role key are needed. No financial rule changed and no specification
conflict was found in this follow-up.

Multi-session hosted concurrency testing, comprehensive hosted role-policy review
and production network reliability remain unverified; local SQL tests are not
proof of those properties. Login/logout browser checks were completed in M1 and
were not repeated here to preserve the user's active session.

M3 remains unimplemented: Quick Order, order list/detail, separate payment/RMB
state transitions, server-side calculations, idempotency and audit events. Read
and resolve its specifications before implementing any of those features.
