# Isna Finance

Mobile-first CNY/IDR operations workspace. **M0 repository foundation only.**
The shell is a public preview, not an authenticated or production-ready finance app.
No financial records, authentication, database access, or AI features are implemented.

## Repository

- `docs/`: specification pack v5 and approved date clarification; start with `docs/README.md`.
- `web/`: Next.js App Router, strict TypeScript, Tailwind CSS, adapted shadcn/ui Card, Lucide.
- `api/`: FastAPI routes and Pydantic schemas; reserved service/repository directories.
- `supabase/`: migration directory and empty seed placeholder; no database changes.
- `ai-evaluation/`: reserved directories for M9, without AI dependencies or real data.

## Prerequisites

Use Node.js 22 LTS (22.14 or newer within 22.x), npm 11, and Python 3.13.
No Docker, Supabase account, or environment secrets are needed for M0.
Run commands from the repository root unless a `cd` is shown.

## Frontend

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:3000. Home is available; later workflow controls are disabled.
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

The root `.env.example` is a variable-name inventory, not a shared runtime file.
`web/.env.example` contains only public variables reserved for M1; when needed,
copy it to `web/.env.local`. `api/.env.example` contains backend-only names;
M0 does not load an API dotenv file. M1 must define validated configuration loading.
No variable is consumed or required by M0.

Never put the Supabase service-role key in the frontend or in a `NEXT_PUBLIC_*`
variable. No service-role access is implemented. `.env` and local environment files
are ignored by Git. Future development fixtures must be synthetic; do not commit
real customer/account data, screenshots, tokens, or exports.

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
`/api/v1/health` on the backend after a preview deployment. M0 makes no cross-origin
API calls; M1 must configure trusted origins as needed when integrating authentication.
No deployment is performed as part of M0. Production readiness remains M10.

References: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation),
[FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi),
[shadcn manual setup](https://ui.shadcn.com/docs/installation/manual).

## Scope and next milestone

Engineering choices: two independent app roots; public static preview; health at
`GET /api/v1/health`; no database readiness check or financial demo data.
See `docs/M0_REPORT.md` for verification and specification notes.

M1 requires a separate authorization: Supabase Auth, a protected application shell,
FastAPI token verification, the owner profile, initial RLS, and tests proving anonymous
denial, authorized owner access, and absence of service-role secrets in the browser.
