# M2 activation and checks

The code and local disposable SQL tests are ready. The M2 migration has NOT been
applied to the user's Supabase project by the agent. No live master data was added.

## Apply the migration

After M1 is active, open Supabase SQL Editor on the development project and run
`supabase/migrations/202609230001_master_data.sql` once in full. It creates customers,
accounts, teams, daily assignments and the private business timezone setting.
Existing owner profiles are kept. If any M2 table/function already exists, stop
and compare schema rather than deleting it or rerunning partial SQL.

The initial timezone is Asia/Jakarta, explicitly chosen under user delegation.
`api/.env` must include `BUSINESS_TIMEZONE=Asia/Jakarta` and `web/.env.local` must
include `API_BASE_URL=http://127.0.0.1:8000`. Local files are already configured.
On Vercel use the HTTPS API origin (server-only variable).

If a later timezone change is deliberately approved, update the private database
setting and the API environment together, then restart the API. API rejects a
mismatch. Do not change timezone after financial posting without reviewing the
reporting implications. Existing explicit dates are never automatically rewritten.

## Run locally

From api/: `.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
From web/: `npm run dev`. Both servers need network access to the Supabase project.
Open More / Data operasional to access Pelanggan, Rekening, Tim, and Rekening harian.

## Verification commands

- api/: `.\.venv\Scripts\python -m pytest`, `python -m ruff check .` using the venv.
- web/: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- supabase/tests/: `npm ci`, `npm test` runs an isolated PGlite PostgreSQL engine with
  synthetic auth fixtures. It never contacts Supabase and requires no Docker.

`master_data.sql` rolls back test data. It requires an EMPTY disposable database,
including no profiles: do NOT run it in the user's now-bootstrapped project.
The local runner provides this isolated database automatically. PGlite tests
verify SQL behavior and RLS under simulated roles, not real Supabase JWT integration
or production concurrency. Hosted RLS/integration review remains required.

## Live acceptance with synthetic data

1. Add/search/edit a synthetic customer.
2. Add two synthetic accounts using only last4; verify masking.
3. Add a synthetic team and a six-place decimal default rate.
4. Choose both accounts for today with one default; refresh and verify persistence.
5. Also assign the first account to tomorrow. Try to deactivate it: expect rejection
   and BOTH dates in the conflict list, with the default and active state unchanged.
6. Follow the date links to explicitly change/remove assignments. Then deactivate
   again: it should succeed. It must disappear from new daily-account choices.
7. A past assignment must remain unchanged. No other default is silently selected.
8. Logout and verify master-data pages redirect to login. Verify API endpoints deny
   requests without a token. Only synthetic data should be used for acceptance.

No orders, payment recognition, ledger entries or financial totals are implemented.
M3 is not started. The requirement excluding inactive accounts from new orders is
recorded for M3; there is intentionally no order endpoint in M2.
