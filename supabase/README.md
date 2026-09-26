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
