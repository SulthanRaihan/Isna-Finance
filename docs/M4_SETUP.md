# M4 activation

M4 code requires migration `supabase/migrations/202609260001_team_activity.sql`.
The user reports applying this migration. Core hosted synthetic browser acceptance
passed on 2026-09-26; see M4_REPORT.md. Do not rerun it on this configured project.

1. After M1/M2/M3 migrations, run the complete M4 migration once in the same
   development project's SQL Editor as postgres. Keep RLS enabled. If its tables
   already exist, stop and compare; do not delete records or apply partial SQL.
2. Restart FastAPI from api/: `.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
3. From web/: `npm run dev`. Open `/activity`, select a team and activity date.
4. Synthetic test: received 100 CNY, distributed 30, adjustment -2.50 yields
   67.50 CNY. Ledger movements create no fee and do not change linked orders.
5. Save actual handled 1 CNY with fee rate 100.005: fee 100.01, unpaid, no outflow.
6. Confirm payment using the actual synthetic payment date, different from the
   activity date. Verify paid status, payment date and locked financial fields.
   Repeating the same payment must not duplicate outflow/audit.
7. Test unpaid edit, stale edit/payment, uncertain same-request retry and owner
   permissions. Never submit real financial data for acceptance.

No new environment variables or service-role credentials. SQL tests in
supabase/tests are for an empty disposable database ONLY, never this project.
Run isolated tests from supabase/tests with `npm test` (all four migrations).
API: pytest, ruff check, ruff format --check. Web: npm test, npm run lint,
npm run typecheck, npm run format:check, npm run build, npm run check:client-secrets.

Request keys are retained while forms stay mounted. If a page is closed/reloaded
after an uncertain response, inspect the ledger/activity before entering again.
Do not infer success from a timeout. Full hosted RLS and concurrency review remain
separate from isolated tests. M3 shared browser acceptance is still partial.
No M5 correction/void, ATM, manual outflows, M6 totals or AI are included.
