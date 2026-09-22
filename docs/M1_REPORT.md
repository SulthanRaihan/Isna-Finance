# M1 implementation report

## Status

M1 code is implemented and locally verified. Live Supabase activation is pending;
M1 is not yet accepted end-to-end against the hosted database. M2 is not started.

## Changes

- Next.js: email/password login, server-managed HttpOnly sessions, protected shell,
  owner/profile verification, logout, denied/unavailable states, session refresh.
- FastAPI: Pydantic environment validation, authoritative Supabase token validation,
  owner-only GET /api/v1/me, consistent 401/403/503 errors. Health remains public.
- Supabase: profiles migration, self-read owner RLS, one-owner constraint, explicit
  administrator bootstrap, rollback-only synthetic SQL verification script.
- Visuals: original user-supplied logo and mobile reference; blue/white responsive
  login. No financial dashboard, balances, transactions, or business features.
- Quality: synthetic auth tests, dependency locks, browser-bundle credential check
  in CI, environment examples and developer/activation instructions.
- Specifications: 14_M1_AUTH.md records the approved single-owner decisions;
  API, security, schema, visual and index documents reference these decisions.

## Verification (Windows, 2026-09-22)

- Frontend: ESLint, TypeScript, production build and Prettier check passed.
- Vitest: 20 tests passed across five files (mocked provider, synthetic identities).
- Backend: Ruff format/lint and 17 pytest tests passed. Two upstream test-client
  deprecation warnings remain; no test failures.
- Browser bundle: synthetic server-only canary and service-role key markers absent.
- Browser: login inspected at 1280x800 and 390x844; anonymous / redirects to /login.
- Supabase Auth settings read succeeded. Email auth enabled, anonymous auth disabled;
  public signup was enabled at the time of the read and still needs disabling.
- SQL migration/RLS tests, owner provisioning, real owner login/logout and hosted
  deployment have NOT been run. Mocked tests do not prove live database access.

## Run

From web/: npm ci; npm run dev. Quality commands: npm run lint,
npm run typecheck, npm test, npm run format:check, npm run build,
npm run check:client-secrets.

From api/ on PowerShell: .\.venv\Scripts\python -m pip install -r requirements-dev.txt;
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000.
Checks: .\.venv\Scripts\python -m pytest and
.\.venv\Scripts\python -m ruff check .

See README.md for initial venv creation and docs/M1_SETUP.md for ordered activation.

## Assumptions and conflicts

Email/password and access exclusively for Isna follow the user's approval. Owner
assignment is explicit and administrator-controlled. A publishable key is public
application configuration, not an administrative credential or access boundary.
No unresolved financial specification conflict was introduced. The approved
business_date semantics and idr_received_at Money In recognition are unchanged.
All test identities are synthetic; local environment configuration is Git-ignored.

## Remaining before M2

Disable public signup, apply migration, run synthetic SQL/RLS checks, create the
owner Auth account, bootstrap its exact UID, and verify live owner login/logout
and API authorization. Do not send a password to chat. Master data belongs to M2
and has not been implemented.
