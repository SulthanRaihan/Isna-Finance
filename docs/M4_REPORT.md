# M4 implementation report - 2026-09-26

## Result

Specifications were updated first for the approved unpaid/payment separation.
M4 implements received/distributed/signed-adjustment ledger, cumulative team CNY
balance through selected date, optional order links, explicit daily handled
volume, Decimal HALF_UP fees, unpaid edits and separate payment confirmation.
Payment uses actual payment_date, creates one canonical team_fee outflow, marks
the activity paid and writes audit atomically. Paid financial fields are locked.
Request keys, row locks and unique source constraints prevent duplicate postings.
Optimistic versions reject edits/payment after an unseen activity change.

## Changes

- docs/01,03,04,05,06,09,10,11,12,16 and index: consistent updated rules.
- docs/17_M4_TEAM_ACTIVITY.md: schema/API contract and retry/version behavior.
- docs/M4_SETUP.md: migration, commands and synthetic acceptance sequence.
- supabase/migrations/202609260001_team_activity.sql: four RLS tables (movements,
  daily activities, canonical outflows, team request keys), checked mutation RPC,
  owner ledger read RPC, decimal audit/replay serialization and indexes.
- api/app/schemas/team_activity.py and api/app/api/team_activity.py: validation,
  authoritative fee calculation, ledger/activity routes and explicit payment.
  main.py, orders.py and repository error mapping integrate M4.
- web/app/activity, app/team-actions.ts, components/team-forms.tsx,
  lib/team-activity.ts: team/date selection, ledger, activity/edit/payment forms,
  preview-only fees and exact-payload retry. Shell/Home enable Activity.
  Order detail displays linked movements without changing order state.
- Backend, SQL and frontend tests; isolated SQL runner now applies four migrations.

## Verification

- 91 backend tests passed, Ruff lint and format passed.
- 50 frontend tests passed; focused form/shell tests passed after final UI changes.
- TypeScript, ESLint, Prettier and production build passed.
- Client build secret/canary scan passed.
- All four migrations and M2/M3/M4 rollback suites passed in isolated PGlite.
  M4 covers rounding, unpaid nonrecognition, activity/payment date separation,
  cumulative signed ledger math, duplicate create/payment, changed-key conflict,
  unpaid edits, stale edit/payment, paid locks, audit count, developer denial and
  direct mutation/delete denial.
- Existing upstream Starlette test-client deprecation warnings remain.

## Limits and assumptions

No unresolved financial specification conflict. Signed adjustments follow F-08;
ledger balances are cumulative through selected day, with daily totals separate.
No new dependencies or environment variables. No real financial data was used.
The user applied the hosted M4 migration; core browser acceptance is recorded
below. Multi-session hosted concurrency and full RLS verification remain pending.
Prior M3 browser acceptance remains partial; see M3_REPORT.md. Passing PGlite is
not production approval.
Keys survive only while a form is mounted; inspect records before re-entry after
reload on uncertain responses. Historical records are never hard deleted.
Only M4 is implemented. M5 ATM/manual outflows/correction/void, M6 summaries and
AI remain future milestones.

## Hosted browser acceptance - 2026-09-26

Using the provisioned owner session, local Next.js/FastAPI and development Supabase:

- API health returned ok. Anonymous GET team-activities returned 401.
- Owner ledger and activity reads succeeded after the user applied M4 SQL.
- Reused `Uji M2 20260924 - Tim Sintetis`, ID
  `e1461df3-382f-43c4-84d4-a01c39d3f316`, on activity date 2026-09-25.
- Created three clearly labeled synthetic movements: received 100, distributed
  30, signed adjustment -2.50. Each returned 201. UI showed cumulative CNY 67.50,
  daily received 100, distributed 30 and adjustment -2.50.
- Created one daily activity with actual handled 1 CNY and rate 100.005.
  API returned 201; refreshed UI showed fee 100.01 and unpaid status.
- Explicitly confirmed fee payment for 2026-09-26. Refreshed UI showed paid,
  Money Out date 2026-09-26, unchanged activity date 2026-09-25 and fee 100.01.
  Financial edit/payment controls disappeared; the ledger balance stayed 67.50.
- Browser keyboard submission was used where the narrow embedded viewport's
  pointer interaction did not activate controls. Date selection via URL was used
  for the read-only ledger filter. Pointer/responsive QA is not marked complete.

The existing synthetic records are retained; do not recreate this activity or
reapply the migration to repeat acceptance. No real financial transactions were
performed. No application code or business rules changed in this acceptance run.
Hosted duplicate-retry fault injection, direct canonical-row/audit count review,
unpaid edit/stale-write scenarios and full role/concurrency checks remain pending;
their isolated automated coverage is documented above, not claimed as live proof.
