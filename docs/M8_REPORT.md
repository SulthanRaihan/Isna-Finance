# M8 implementation report

Date: 2026-09-28. Scope: M8 only. Implementation and local verification complete;
hosted activation and live synthetic acceptance remain pending.

## Delivered

- OpenAI Responses vision adapter with strict Structured Outputs, configurable
  `gpt-5.4-mini`, environment-only credentials, and no automatic provider retries.
- Owner-authorized, one-use upload jobs; private PNG/JPEG upload, 5,000,000-byte
  and 20-megapixel validation; server-side image decoding and Pydantic validation.
- Editable draft, exact customer matching, confidence and review warnings. Multiple
  orders produce a warning without selecting one. Applying a draft does not save
  an order. The existing order API remains authoritative for financial calculations.
- Immediate image deletion on successful/failed processing plus an independent
  orphan cleanup worker, five-minute schedule and stale-heartbeat upload gate.
- Manual Quick Order remains available when extraction is disabled or unavailable.

## Files changed

- Backend: `api/app/api/extraction.py`, `core/ai_config.py`,
  `repositories/extraction.py`, `schemas/extraction.py`, `services/ai/{provider,
  images,drafts}.py`, router registration, dependency locks, environment example,
  extraction/health/security tests.
- Frontend: `web/app/extraction-actions.ts`, `components/screenshot-extractor.tsx`,
  `components/order-editor.tsx`, `lib/extraction.ts`, API timeout support,
  extraction/order tests and client-secret scanning; CI adds an OpenAI canary.
- Supabase: `202609280001_ai_extraction.sql`, `functions/ai-cleanup/`,
  `config.toml`, `ai-cleanup-schedule.sql`, local migration/security/cleanup tests.
- Documentation: AI, API, privacy/security, schema and wireframe specifications;
  `21_M8_EXTRACTION.md`, `M8_SETUP.md`, documentation and repository READMEs.

## Verification

- Backend: 174 tests passed; Ruff lint and formatting passed. Two existing
  Starlette/AnyIO deprecation warnings remain.
- Frontend: 65 tests across 16 files passed; ESLint, TypeScript and formatting
  passed. Production build and browser-bundle secret scanning passed with synthetic
  OpenAI and service-role canaries.
- Database: all eight migrations and local rollback-only SQL suites passed.
- Cleanup worker: three tests passed, including authorization, retention threshold,
  orphan removal and heartbeat failure behavior.
- Git whitespace validation passed. Only synthetic fixtures/provider mocks used.

## Activation and remaining verification

Follow [M8_SETUP.md](M8_SETUP.md) for commands and deployment steps. Apply the M8
migration with RLS enabled, deploy the cleanup function, configure its dedicated
secret and Vault-backed schedule, and verify an orphan cleanup/heartbeat. Then set
the backend OpenAI key privately and enable extraction. Both API credentials and
the feature were unconfigured/disabled when this report was written.

No hosted M8 migration, Edge Function deployment, scheduled cleanup, live OpenAI
request or hosted signed-upload acceptance has been performed. Local Storage
fixtures do not emulate the hosted Storage HTTP service. Verify these with synthetic
images before real use; do not interpret local tests as a live retention guarantee.

## Assumptions and specification resolution

The frozen rules were incorporated into documentation before implementation. No
unresolved business-rule conflict was found and no financial recognition rule was
changed. Technical limits (ticket quotas, timeouts and expiry) are documented in
`21_M8_EXTRACTION.md`. The 5 MB limit uses decimal bytes. Direct private Storage
upload accommodates Vercel's smaller request-body limit.

The cleanup schedule deletes objects at 45 minutes, allowing margin inside one
hour. Missing/stale heartbeat blocks new uploads; infrastructure outages still need
monitoring and recovery. OpenAI retention is separate from application storage;
`store=false` does not establish Zero Data Retention.

M9 evaluation datasets, accuracy metrics and model comparisons are not implemented.
