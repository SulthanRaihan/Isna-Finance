# M3 activation and shared acceptance

Code is ready for M3. The agent has NOT applied the M3 migration to hosted
Supabase or created live orders. Browser acceptance is deferred at the user's
request. Existing M1/M2 setup and environment variables remain valid.

## Apply once when ready to test together

1. Open the same development Supabase project's SQL Editor as postgres.
2. Run `supabase/migrations/202609250001_orders.sql` in full, once. RLS stays
   enabled; the migration enables and forces it on all three new tables.
3. If orders/audit_logs/idempotency_keys or mutate_order already exists, stop
   and compare the schema. Do not delete tables or rerun partial migration SQL.
4. Restart FastAPI to load the new router. Restart Next.js if it is not running.

No new environment variables, service-role key or Docker are needed.
Never execute supabase/tests/*.sql against the provisioned owner project: those
scripts require an empty disposable database. Use the isolated runner below.

## Local commands

From api/ in PowerShell:

```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

From web/: `npm run dev`. Open http://localhost:3000/orders/new.
Both servers need network access to Supabase.

Automated verification:

- api/: `.\.venv\Scripts\python -m pytest`,
  `.\.venv\Scripts\python -m ruff check .`,
  `.\.venv\Scripts\python -m ruff format --check .`.
- web/: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm run build`, `npm run check:client-secrets`.
- supabase/tests/: `npm ci` then `npm test`. Runs all migrations and both M2/M3
  rollback tests in isolated PGlite, without contacting Supabase.

## Shared browser acceptance (synthetic only)

1. Select active test accounts for today's business date; set one as default.
2. Quick Order: search/add a synthetic customer, enter CNY 1 and rate 100.005.
   Verify default preselection and explicit override; save should show IDR 100.01.
3. Check search, date/payment/fulfillment/account filters and order detail/audit.
4. While awaiting + pending, edit amount/rate and confirm the audit/calculation.
5. Record IDR received at an actual synthetic time with explicit UTC offset.
   Check Money In date, including a UTC instant that is the next day in Jakarta.
6. Verify the five material fields lock after receipt; note edits still work.
7. Use a second synthetic order to mark RMB sent before receiving IDR. Verify
   the warning and material-field lock, then receive IDR and check Completed.
8. Simulate a connection interruption after saving; use the same-request retry
   button. Verify one order/one event, never assume timeout means rollback.
9. Try an unassigned/inactive account and changed payload with an existing
   idempotency key through the API; verify rejection and no unintended writes.
10. Confirm anonymous/developer denial and hosted RLS policies separately.

Uncertain retries keep their key/payload only while the form remains mounted.
If the page is closed/reloaded, inspect Orders before entering the order again.
Do not use real financial data before shared acceptance and production checks.

No M4 ledger/outflow/fee features, dashboard totals or AI are implemented.
