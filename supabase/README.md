# Supabase

M1 provides the profiles migration, explicit owner bootstrap, and rollback-only RLS
verification script. Follow `../docs/M1_SETUP.md` in order. No live migration has been
applied by the implementation agent. Use a development project and synthetic data.

Public registration must be disabled. No service-role key is used by the apps.
Future financial tables and storage remain outside M1.

M2 adds master-data tables and atomic daily assignments. Follow `../docs/M2_SETUP.md`.
The database enforces the frozen deactivation rule even on direct account updates.
Local disposable tests run with `cd tests`, `npm ci`, `npm test`; no Docker needed.

M3 and M4 add orders and explicit team fee payment. M5 adds ATM/card payment and
manual outflow void/correction chains. Apply `202609270001_money_out.sql` after
M1-M4, following `../docs/M5_SETUP.md`; keep RLS enabled. All five migrations and
rollback-only synthetic regression suites run in the disposable local test runner.
Never run fixture SQL on the hosted project.

M6 adds a read-only reporting RPC and owner-readable business balance openings.
Apply `202609270002_reporting.sql` after M5, following `../docs/M6_SETUP.md`.
No opening amount is seeded. Local tests now apply all six migrations.

M7 reviews all 15 tables and nine public RPCs and revokes private-helper EXECUTE.
Apply `202609270003_security.sql` after M6; see `../docs/M7_SETUP.md`.
Local tests apply seven migrations and include security catalog/role regressions.

M8 adds private temporary screenshot storage and upload-job metadata. Follow
`../docs/M8_SETUP.md`: migration, cleanup Edge Function, Vault-backed five-minute
schedule and verified heartbeat before enabling extraction. Do not put Groq API keys or
cleanup secrets in SQL files, Git, NEXT_PUBLIC variables or the frontend.
