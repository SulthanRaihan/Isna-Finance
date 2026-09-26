# M5 implementation report — 2026-09-27

## Result

M5 only: ATM/card activity (unpaid calculation and explicit fee payment), manual
RMB purchase/exchange fee/other Money Out, posted/voided listings, atomic void and
correction, linked history and owner-only audit. M3 order locks and Money In
recognition are unchanged. No M6 dashboard or recap was implemented.

The user-frozen decisions were recorded in financial engine, schema, API and
related specification files. Initial API and SQL regression tests were written
before implementing the new workflow. The new migration does not edit or rerun
applied M1-M4 migrations; it updates the M4 payment function's canonical lookup to
follow the end of a correction chain, including a terminal voided posting.

## Verification

- API: 118 tests passed; Ruff lint and formatting passed.
- Frontend: 54 tests passed; ESLint, TypeScript and Prettier passed.
- Production Next.js build passed; client bundle secret/canary scan passed.
- Disposable PGlite: all five migrations and M2/M3/M4/M5 SQL suites passed.
- SQL checks include unpaid ATM exclusion, separate payment date, fee 9520.00,
  duplicate payment/audit protection, correction for all five categories,
  multi-step chain, source preservation, stale request rejection, and void exclusion.
- Injected replacement-audit failure proved rollback of original void, replacement,
  audit changes and request key. Invalid corrections also roll back.
- Anonymous/developer RPC denial, developer read denial and direct write/delete
  denial verified locally. M3 order regression suite remains green.
- Existing Starlette/httpx and AnyIO deprecation warnings remain; no dependency
  changes were made in this milestone.

Hosted M5 migration and shared browser acceptance remain pending. Isolated tests
are not evidence of hosted concurrency behavior; concurrent multi-session testing
on real PostgreSQL remains part of hosted verification. No real financial records
were created or modified for this work.

## Decisions and conflicts

No unresolved specification conflict remains. Canonical correction values live on
replacement outflows; paid operational records keep their original evidence.
Category/source identity is preserved. A void never means a refund or makes a fee
unpaid. Exchange fee uses actual IDR, never an inferred formula. Money values use
Decimal HALF_UP / PostgreSQL numeric validation; browser calculations are previews.
No new environment variables, service-role credentials, dependencies or Docker.

## Commands and activation

Follow [M5 setup](M5_SETUP.md): run the complete new migration once with RLS enabled,
restart FastAPI, then run `npm run dev` from web. Existing local environment files
are sufficient. The setup document contains all verification commands and the
synthetic shared acceptance sequence. Do not run fixture SQL on the hosted project.

## Files created

- `api/app/api/money_out.py`
- `api/app/schemas/money_out.py`
- `api/app/services/money_out.py`
- `api/tests/test_money_out.py`
- `docs/18_M5_MONEY_OUT.md`
- `docs/M5_SETUP.md`
- `supabase/migrations/202609270001_money_out.sql`
- `supabase/tests/money_out.sql`
- `web/app/atm/page.tsx`
- `web/app/money-out-actions.ts`
- `web/app/outflows/[id]/page.tsx`
- `web/app/outflows/page.tsx`
- `web/components/current-posting.tsx`
- `web/components/money-out-forms.tsx`
- `web/lib/money-out.ts`
- `web/tests/money-out-forms.test.tsx`
- `docs/M5_REPORT.md` (this report)

## Files changed

- `README.md`
- `api/app/api/team_activity.py`
- `api/app/main.py`
- `api/app/repositories/master_data.py`
- `api/tests/test_health.py`
- `docs/01_BUSINESS_RULES.md`
- `docs/03_DATA_MODEL.md`
- `docs/04_UX_INFORMATION_ARCHITECTURE.md`
- `docs/05_FINANCIAL_ENGINE.md`
- `docs/06_API_CONTRACT.md`
- `docs/10_POSTGRES_SCHEMA.md`
- `docs/11_WIREFRAMES.md`
- `docs/README.md`
- `supabase/README.md`
- `supabase/tests/run-local.mjs`
- `web/app/activity/page.tsx`
- `web/app/more/page.tsx`
- `web/components/team-forms.tsx`
- `web/lib/team-activity.ts`
- `web/tests/team-forms.test.tsx`

## Remaining work

Apply M5 migration and complete shared synthetic acceptance. M6 is next only after
authorization: dashboard/daily recap, posted-only Money Out aggregation and existing
Money In recognition, profit and reconciliation views. No M6 work is included here.
