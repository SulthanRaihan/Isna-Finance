# M0 completion report

## Delivered

Repository foundation only: Next.js/TypeScript frontend, Tailwind semantic tokens,
adapted shadcn/ui Card, responsive preview shell, FastAPI/Pydantic liveness endpoint,
frontend/backend tests and lint/format configuration, dependency locks, GitHub Actions,
environment-name examples, and developer/Vercel setup instructions.

No authentication, database schema, financial calculations, business endpoints,
transaction fixtures, AI behavior, or deployment has been implemented.

## Specification reconciliation

The user-approved clarification appears in documents 01, 03, 05, 06, and 10:

| Record / metric | Date semantics |
| --- | --- |
| `financial_outflows.business_date` | Actual date the money went out |
| `orders.business_date` | Operational/order date |
| Money In | Business-local date derived from `idr_received_at`, only when payment is received |
| `team_movements.business_date` | Actual activity date |
| `team_daily_activities.business_date` | Actual activity date |
| `atm_card_activities.business_date` | Actual activity date |

The F-03 query now uses `business_date`. Money In does not use the order date or
creation timestamp. Activity and cash-out dates are explicitly distinct concepts.
Financial recognition rules have not changed.

Editorial cleanup points the older logical model to the already-frozen canonical
outflow strategy and uses the frozen `team_daily_activity` source identifier
consistently. The obsolete open team-activity choice was removed in favor of the
existing frozen decision. The documentation index now points to the supplied
visual system. The health endpoint is documented in the API contract.

No unresolved specification conflict affects the implemented M0 scope. Business
milestones still require their own specification review before implementation.

## Verification

Verified locally on Windows with Node 22.14.0 and Python 3.13.3:

- Frontend ESLint with zero warnings: passed.
- TypeScript check: passed.
- Prettier format check: passed.
- Vitest: 1 shell test passed (navigation, disabled workflows, semantic landmarks).
- `next build`: passed; home is statically prerendered.
- Production server HTTP smoke check: 200 with expected shell content.
- Browser review: desktop and 390 x 844 phone viewport; disabled future controls visible.
- Ruff lint and formatting: passed.
- pytest: 3 tests passed (public liveness contract, no domain routes, no health writes).
- Python dependency consistency (`pip check`): passed.
- Live `GET /api/v1/health`: 200, `{"status":"ok"}`.
- npm audit: zero reported vulnerabilities at verification time.
- Frontend manifest matches the dependency lock.
- Local environment files, virtual environments, and dependencies are Git-ignored.

GitHub Actions is configured for Linux but its remote run is separate from these
local results. No Vercel deployment was performed. This is not production readiness.

Toolchain notes: ESLint 9.39.5 is pinned because the React plugin bundled with this
Next.js version fails under ESLint 10. npm marks ESLint 9 deprecated; revisit when
updating the Next.js lint toolchain. jsdom 27 supports the selected Node runtime.
Backend tests emit two upstream Starlette/AnyIO deprecation warnings; assertions pass.

## Commands

See the root README for complete Windows and macOS/Linux setup and deployment notes.

Frontend, from `web/`:

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

Backend, from `api/` (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m ruff format --check .
```

## Engineering assumptions

- Independent `web/` and `api/` app roots keep setup and deployment simple.
- M0 is a public preview; protection is M1. Future workflows are disabled.
- Liveness is public at `/api/v1/health` and deliberately independent of Supabase.
- No financial demo data is needed; seed SQL is an inert placeholder.
- Environment examples reserve names for M1; no credentials are required or loaded.
- System sans-serif typography and provisional blue tokens follow the visual spec.
- A Lucide wallet glyph is a placeholder, not a replacement for the approved logo.
- Vercel setup uses two projects from one repository, with roots `web` and `api`.

## What remains for M1

Supabase Auth, protected shell, FastAPI token validation, owner profile, initial
RLS policies, and tests for anonymous denial, authenticated owner access, and
absence of service-role credentials from the browser. M1 is not started.

## File inventory

All files are new to the previously empty repository. The six specification files
with edits relative to ZIP v5 are `docs/README.md`, `01_BUSINESS_RULES.md`,
`03_DATA_MODEL.md`, `05_FINANCIAL_ENGINE.md`, `06_API_CONTRACT.md`, and
`10_POSTGRES_SCHEMA.md`; other supplied specifications are preserved.

- `.editorconfig`
- `.env.example`
- `.gitattributes`
- `.github/workflows/ci.yml`
- `.gitignore`
- `README.md`
- `THIRD_PARTY_NOTICES.md`
- `ai-evaluation/README.md`
- `ai-evaluation/evaluation/.gitkeep`
- `ai-evaluation/reports/.gitkeep`
- `ai-evaluation/synthetic_dataset/.gitkeep`
- `api/.env.example`
- `api/.python-version`
- `api/app/__init__.py`
- `api/app/api/__init__.py`
- `api/app/api/health.py`
- `api/app/core/.gitkeep`
- `api/app/main.py`
- `api/app/models/.gitkeep`
- `api/app/repositories/.gitkeep`
- `api/app/schemas/__init__.py`
- `api/app/schemas/health.py`
- `api/app/services/ai/.gitkeep`
- `api/app/services/financial/.gitkeep`
- `api/pyproject.toml`
- `api/requirements-dev.txt`
- `api/requirements.txt`
- `api/tests/test_health.py`
- `docs/01_BUSINESS_RULES.md`
- `docs/02_MVP_SCOPE.md`
- `docs/03_DATA_MODEL.md`
- `docs/04_UX_INFORMATION_ARCHITECTURE.md`
- `docs/05_FINANCIAL_ENGINE.md`
- `docs/06_API_CONTRACT.md`
- `docs/07_AI_SYSTEM_DESIGN.md`
- `docs/08_SECURITY_PRIVACY.md`
- `docs/09_IMPLEMENTATION_PLAN.md`
- `docs/10_POSTGRES_SCHEMA.md`
- `docs/11_WIREFRAMES.md`
- `docs/12_CODEX_PROMPTS.md`
- `docs/13_VISUAL_DESIGN_SYSTEM.md`
- `docs/M0_REPORT.md`
- `docs/README.md`
- `supabase/README.md`
- `supabase/migrations/.gitkeep`
- `supabase/seed.sql`
- `web/.env.example`
- `web/.nvmrc`
- `web/.prettierignore`
- `web/.prettierrc.json`
- `web/AGENTS.md`
- `web/CLAUDE.md`
- `web/app/globals.css`
- `web/app/layout.tsx`
- `web/app/page.tsx`
- `web/components.json`
- `web/components/app-shell.tsx`
- `web/components/ui/card.tsx`
- `web/eslint.config.mjs`
- `web/lib/utils.ts`
- `web/next-env.d.ts`
- `web/next.config.ts`
- `web/package-lock.json`
- `web/package.json`
- `web/postcss.config.mjs`
- `web/tests/setup.ts`
- `web/tests/shell.test.tsx`
- `web/tsconfig.json`
- `web/vitest.config.ts`
