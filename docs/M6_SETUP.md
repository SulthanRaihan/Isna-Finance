# M6 activation and acceptance

M6 adds dashboard and daily recap only. It requires
`supabase/migrations/202609270002_reporting.sql` after M1-M5. This migration has
not been applied to the hosted project by the implementation agent.

1. In the same Supabase development project, run the complete
   [M6 migration](../supabase/migrations/202609270002_reporting.sql) once as postgres.
   Keep RLS enabled; new opening records are owner-readable and application writes
   are denied. Do not rerun older migrations or delete existing financial records.
   If the new table/function already exists, stop and compare migration state.
2. Restart FastAPI from `api/`:
   `.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
   `/openapi.json` should report API version 0.6.0.
3. Restart frontend from `web/` with `npm run dev`. After running a production build,
   restart an existing development server so server/client assets remain consistent.
4. Open Home `/`, choose a date, then open `/recaps`. Use the sections Orders,
   Money In, Money Out, Needs Attention, and Team Balances. Summaries include all
   records; list pagination does not change totals. Default date uses Asia/Jakarta.

No new environment variables, dependency installations, service-role secret or
Docker are required. Existing `.env` files remain sufficient.

## Opening position

If no opening exists on/before the selected date, Home/recap display **Belum
dikonfigurasi** and API returns `business_position.status=not_configured` with
null amount. This is expected; do not enter a fabricated zero to remove the message.
The latest opening means start of effective_date, and that day's transactions
are included. Reporting is ready to consume deliberately provisioned openings.
M6 does not introduce an opening-entry/edit UI or API; such a workflow has not
been specified. No opening is inserted by this migration or acceptance steps.

## Shared synthetic acceptance

Do not recreate existing M3-M5 fixtures. These known records can be inspected:

- 2020-01-03: M5 exchange fee 19.25 remains posted; the ATM original/replacement
  are both voided. Money Out should include 19.25 and exclude the voided ATM chain
  unless other synthetic records have since been deliberately posted on that date.
- 2026-09-25: synthetic M3 order has operational CNY 2 / expected IDR 200.01. Its
  current status must be inspected; an awaiting order contributes no Money In.
- 2026-09-26: original synthetic team fee 100.01 was paid in M4 (inspect any later
  explicit correction before asserting its current posting).
- Synthetic team cumulative balance was 67.50 CNY on 2026-09-25. A non-zero balance
  is an informational reconciliation condition, not an error or a profit amount.

Then use synthetic-only test cases for one customer with two orders (1 unique
customer, 2 orders), receipt on a different operational date, unresolved prior-date
orders, and a now-completed older order. Confirm the current-status disclaimer.
Opening selection/inclusion is tested in the disposable suite; do not invent a
real hosted opening for acceptance. Verify owner-only access and unavailable-data
messages. Full hosted acceptance remains distinct from automated local tests.

## Local checks

- `api/`: `.\.venv\Scripts\python -m pytest`, `.\.venv\Scripts\ruff check app tests`,
  `.\.venv\Scripts\ruff format --check app tests`.
- `web/`: `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`,
  `npm run build`, `npm run check:client-secrets`.
- `supabase/tests/`: `npm ci` then `npm test`. All SIX migrations and rollback-only
  suites run on a fresh in-memory PGlite database. Never run test fixture SQL in
  the hosted project.

M7 security hardening and all later milestones are not included in M6.
