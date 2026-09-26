# Isna Finance

Mobile-first CNY/IDR operations workspace. M1 login and M2 master data are active.
M3 Orders has partial hosted synthetic acceptance. M4 team ledger and explicit
fee payment are activated with core hosted synthetic acceptance; see
[M4 setup](docs/M4_SETUP.md). M5 ATM/card, manual Money Out, void, and atomic
corrections are implemented; activation and shared acceptance are pending:
[M5 setup](docs/M5_SETUP.md). M6 dashboard/recap and AI remain out of scope.

## Repository

- `docs/`: specification pack v5 and approved date clarification; start with `docs/README.md`.
- `web/`: Next.js App Router, strict TypeScript, Tailwind CSS, adapted shadcn/ui Card, Lucide.
- `api/`: FastAPI routes and Pydantic schemas; reserved service/repository directories.
- `supabase/`: reviewed-in-code profiles migration, explicit owner bootstrap, and RLS checks.
- `ai-evaluation/`: reserved directories for M9, without AI dependencies or real data.

## Prerequisites

Use Node.js 22 LTS (22.14 or newer within 22.x), npm 11, and Python 3.13.
No Docker is required. M1 live login requires a development Supabase project,
the public project configuration, and the activation steps in `docs/M1_SETUP.md`.
Automated tests use synthetic mocked identities and need no Supabase credentials.
Run commands from the repository root unless a `cd` is shown.

## Frontend

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:3000. Anonymous visitors are redirected to `/login`.
Only the provisioned owner can open Home; later workflow controls remain disabled.
In another terminal, run quality checks from `web/`:

```sh
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
npm start
```

Stop the development server before `npm start` if both would use port 3000.
`npm run format` applies Prettier formatting to frontend source/configuration.
The system sans-serif stack avoids build-time font downloads.

## Backend (PowerShell)

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

No PowerShell activation-policy changes are needed. In another terminal, from `api/`:

```powershell
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m ruff format --check .
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
```

Expected response: `{"status":"ok"}`. This checks process liveness only, not database
readiness. API documentation is at http://127.0.0.1:8000/docs.

On macOS/Linux, use `python3.13 -m venv .venv` and substitute `.venv/bin/python`
for `.\.venv\Scripts\python` in the remaining commands. Use `curl` for the HTTP check.
`python -m ruff format .` formats Python files when using the virtual environment.

## Configuration and secrets

The root `.env.example` is a variable-name inventory. Copy `web/.env.example` to
`web/.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Copy `api/.env.example` to `api/.env` and
fill in `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` using the same public values.
FastAPI validates configuration using Pydantic Settings. Environment files are ignored
by Git; no project-specific credentials belong in committed examples.

No service-role key is needed. Both apps use user-context reads protected by RLS.
Next.js handles Supabase sessions on the server in HttpOnly cookies; proxy refreshes
sessions and server page guards revalidate identity and profile. `/api/v1/me` accepts
a user's Bearer token and independently validates it with Supabase Auth. Its responses
and auth pages are not cached. Health remains public even without configuration.

Run `npm run check:client-secrets` after a frontend build. CI builds with a synthetic
server-only canary and verifies it never appears in the browser bundle.

## Dependency maintenance

Frontend dependencies are locked in `web/package-lock.json`; use `npm ci`.
Backend runtime/test environments are pinned in `api/requirements*.txt`.
Install runtime-only dependencies with `python -m pip install -r requirements.txt`.
After deliberately updating `api/pyproject.toml`, regenerate both locks from `api/`
using the virtual-environment Python:

```sh
python -m piptools compile pyproject.toml --output-file requirements.txt --strip-extras
python -m piptools compile pyproject.toml --extra dev --constraint requirements.txt --output-file requirements-dev.txt --strip-extras
```

Review lock changes and rerun all checks. CI checks the backend on Linux; local verification uses Windows.

## Vercel-compatible deployment

The two apps can be imported from the same Git repository as separate Vercel projects:

| Project | Root directory | Framework | Build / entrypoint |
| --- | --- | --- | --- |
| Frontend | `web` | Next.js | `npm run build` (framework defaults) |
| Backend | `api` | FastAPI | `app.main:app`, declared in `pyproject.toml` |

Use Node 22.x for the frontend and Python 3.13 for the API. Vercel detects FastAPI
from the project metadata; runtime requirements are provided separately from dev tools.
No Docker or custom server wrapper is required. Verify `/` on the frontend and
`/api/v1/health` on the backend after a preview deployment. M1 makes no browser-to-FastAPI cross-origin
requests; session/profile checks run server-side. Add explicit trusted origins if a
later milestone adds browser API access. No hosted deployment has been performed. Production readiness remains M10.

References: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation),
[FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi),
[shadcn manual setup](https://ui.shadcn.com/docs/installation/manual).

## Scope and next milestone

See `docs/M0_REPORT.md` for historical foundation verification and `docs/M1_SETUP.md`
for the current activation and acceptance checklist. `docs/14_M1_AUTH.md` records
approved authentication decisions and visual direction.

M1 owner login, refresh, logout and post-logout denial were verified live. Hosted
RLS and direct bearer API verification remain distinct from mocked tests. M2
(customers/accounts/teams) requires its migration and live acceptance in
`docs/M2_SETUP.md`. Financial recognition rules are unchanged.

## Business timezone

The API uses `BUSINESS_TIMEZONE=Asia/Jakarta` (WIB) as an explicit initial
business calendar. Set a valid IANA name in `api/.env` and the API deployment
environment; restart after changes. Do not duplicate it as a device-local or
per-user date preference. The M2 daily-account UI reads the API business date from the database clock.
The private database timezone and API configuration must match; see docs/M2_SETUP.md.
The current change adds the tested calendar foundation, not financial recognition
endpoints. Dates already explicitly selected by the user are not timezone-shifted.

`tzdata` supplies IANA data on Windows, following the
[Python zoneinfo guidance](https://docs.python.org/3/library/zoneinfo.html#data-sources).
