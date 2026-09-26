# M5 activation and shared acceptance

M5 code requires **202609270001_money_out.sql** after the existing M1-M4 migrations.
M5 has not yet been applied or tested on the hosted project by this implementation.
No new environment variables, secrets, service-role key, or Docker are needed.

1. Open Supabase SQL Editor in the same development project. Run the **complete**
   [M5 migration](../supabase/migrations/202609270001_money_out.sql) once as postgres.
   Keep **RLS enabled**. The migration enables/forces RLS on its new tables and
   retains owner restrictions on existing financial tables. Do not rerun M1-M4.
   If M5 tables already exist, stop and compare migration state; do not delete data.
2. Restart FastAPI from `api/`:
   `.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
3. From `web/`, run `npm run dev`. Log in as owner; open `/atm` or `/outflows`.
4. Synthetic ATM test: activity date 2020-01-01, CNY 5600, rate 1.7. Save unpaid:
   fee 9520.00, no Money Out. Confirm payment dated 2020-01-03. Check exactly one
   outflow on Jan 3, unchanged activity date, and locked paid inputs.
5. Create synthetic RMB purchase: 1 CNY * 100.005 = 100.01 IDR. Create exchange fee
   using actual IDR 19.25 (no CNY/rate fields), and another manual expense.
6. Open a posting, correct it with a reason and actual money-out date. Verify old
   posting is voided, replacement linked, and only the replacement is in the
   default active list. Check the full chain/audit. Repeat for team and ATM fees;
   original paid activity snapshots must remain unchanged.
7. Void a synthetic posting with a reason. It remains visible under Voided/All
   history and disappears from the default active list. Void is **not a refund**.
   An activity remains paid after void; never create another payment for it.
8. Together, verify stale edits, duplicate/retry behavior, permissions and mobile
   layout using synthetic records. Do not re-enter a transaction after an uncertain
   timeout. The mounted form retries with the same exact payload/key; after reload,
   inspect the list and audit before deciding whether another entry is needed.

## Local verification commands

From `api/`: `.\.venv\Scripts\python -m pytest`,
`.\.venv\Scripts\ruff check app tests`, `.\.venv\Scripts\ruff format --check app tests`.
From `web/`: `npm test`, `npm run lint`, `npm run typecheck`,
`npm run format:check`, `npm run build`, `npm run check:client-secrets`.
From `supabase/tests/`: `npm ci` then `npm test` for disposable PGlite tests.
Never run test fixture SQL against the hosted project: fixtures are synthetic and
intended only for an empty disposable database. The runner applies all five migrations.

Hosted shared browser acceptance and real PostgreSQL concurrent-request testing
remain separate from isolated verification. M6 dashboard/recap is not implemented.
