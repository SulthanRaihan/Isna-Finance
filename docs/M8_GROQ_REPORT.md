# M8 Groq Free-tier update

Date: 2026-09-28. Supersedes the provider configuration of initial commit 0422500.
Scope remains M8 only; no financial rule changes or M9 work.

## Configuration and implementation

Specifications were updated before code. Groq is the only implemented adapter,
using qwen/qwen3.8-27b vision and strict JSON-schema output via Chat Completions.
The provider protocol and normal order validation remain independent. There is
one provider request per extraction, no automatic retries, paid fallback or billing
upgrade. Quota/rate-limit/outage errors produce a generic unavailable response.
Manual order entry remains usable and can save after AI failure.

Backend environment names are GROQ_API_KEY, GROQ_MODEL,
GROQ_FREE_TIER_CONFIRMED and AI_EXTRACTION_ENABLED. The local ignored environment
contains disabled/unconfirmed defaults and a blank Groq key slot. No key from chat
was stored or used. Use a rotated key privately. Free tier must be confirmed in
Groq Billing; the confirmation flag is an operator attestation, not automatic
billing detection. An externally upgraded organization cannot be made free by code.

## Hosted cleanup verification

Read-only verification after dashboard login:

- AI upload-job table exists: true.
- Edge Functions dashboard shows no deployed functions.
- GET ai-cleanup endpoint returns HTTP 404 / NOT_FOUND.
- cron.job exists: false (scheduler is not installed).
- private.ai_cleanup_state.last_success: NULL.

Therefore only the AI database migration is confirmed. Cleanup function, secrets,
cron schedule and successful orphan removal are PENDING, not active. AI remains
disabled. No hosted schema changes or deployments were made during this update.
Immediate deletion attempts remain in the extraction finally block on success or
failure; independent cleanup is the orphan safety net. Its 45-minute cutoff and
five-minute schedule must be deployed and tested to meet the one-hour maximum.
The retention requirement has NOT been verified in this environment.

## Files and verification

Changed provider/settings/API adapter wiring and environment example; updated
AI/API/security specifications and setup; frontend provider disclosure/error text;
CI and browser-secret scanner; provider and manual-order regression tests. Added
supabase/verify-ai-cleanup.sql with read-only checks that exclude secrets.

- Backend: 183 tests passed; Ruff lint/format passed (two upstream deprecation warnings).
- Frontend: 66 tests passed, including saving a manual order after quota exhaustion.
- Cleanup worker: three existing tests passed; no SQL migration change was needed.
- Frontend lint, typecheck and formatting passed. Production build and browser
  secret scan passed with synthetic Groq, legacy OpenAI and service-role canaries.

Live Groq extraction was not called. Billing Free-tier status, rotated key, hosted
cleanup deployment and real signed-upload/cleanup acceptance remain unverified.
See [M8_SETUP.md](M8_SETUP.md) for activation steps and commands.
