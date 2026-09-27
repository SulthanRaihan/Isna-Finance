# M8 setup: screenshot draft extraction

M8 remains disabled until all steps below succeed. Manual Quick Order works without
AI. Verified in the hosted dashboard on 2026-09-28: AI migration exists, no Edge
Functions are deployed, cron.job is absent, and cleanup last_success is NULL.
The public cleanup endpoint also returned 404 NOT_FOUND. Cleanup function and
schedule are pending deployment/configuration; SQL alone is not operational cleanup.

## 1. Database and Storage

Already applied in this project; do not rerun. For a new environment, run
`supabase/migrations/202609280001_ai_extraction.sql` once after M7, as administrator
in Supabase SQL Editor. Keep RLS enabled. This creates a PRIVATE isna-ai-temp bucket
limited to image/png and image/jpeg, 5,000,000 bytes, plus owner-bound upload jobs.
Do not enable public bucket access or add broad storage policies. Review any existing
storage policies that could permit access to this bucket.

## 2. Independent cleanup worker (required before enabling upload)

Deploy `supabase/functions/ai-cleanup/index.ts` together with `cleanup.mjs`, using
Supabase Edge Functions. Its configuration in `supabase/config.toml` disables the
platform JWT check only for this function; the handler authenticates a dedicated
AI_CLEANUP_SECRET. Generate a strong random secret and set it through Supabase's
Edge Function secret settings, never in source or chat. SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY are the Edge Function's server-only runtime variables.
The service-role credential is used only by this cleanup worker; do not copy it
into api/.env or web/.env.local.

Store Vault secrets named project_url (your Supabase HTTPS URL) and ai_cleanup_secret
(the same dedicated cleanup secret), through the dashboard. Enable pg_cron/pg_net
if required by the project. Run `supabase/ai-cleanup-schedule.sql` once; do not create
duplicate jobs. It calls the worker every five minutes. The worker deletes objects
>=45 minutes old using Storage API and updates a database heartbeat only on success.
Check scheduler HTTP results and Edge Function logs for success without exposing
secret header values. Configure monitoring for failed sweeps and stale heartbeat.

Run `supabase/verify-ai-cleanup.sql` for read-only checks without printing secret
values or cron command text. Also confirm ai-cleanup is deployed in Edge Functions.
Verify last_success in private.ai_cleanup_state as administrator after at least one
successful scheduled run. Test cleanup of a deliberately orphaned SYNTHETIC image;
check both object disappearance and successful heartbeat before enabling the feature.
Do not simulate deletion by removing storage.objects metadata in SQL.

Uploads fail closed when heartbeat is missing/stale (>10 minutes). This protects
new uploads but cannot guarantee deletion during a storage-provider outage; existing
orphan cleanup requires working infrastructure and monitoring. The 45-minute cutoff
plus five-minute schedule leaves margin within the one-hour retention bound.

## 3. API environment

Install updated dependencies from api/ with:
`.\.venv\Scripts\python -m pip install -r requirements-dev.txt`

In the ignored backend api/.env (or backend deployment environment), set:

```dotenv
GROQ_API_KEY=<enter rotated key privately in the environment>
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_FREE_TIER_CONFIRMED=true
AI_EXTRACTION_ENABLED=true
```

Only set enabled=true after cleanup verification AND confirming the Groq organization
is on Free in Billing. GROQ_FREE_TIER_CONFIRMED is an operator attestation, not an
automatic billing check. Never upgrade the organization or use a paid organization
key; there is no request flag that makes a paid account free. Revoke any key exposed
in chat and enter its replacement directly in the ignored backend environment.
No paid-provider fallback or automatic retry is implemented. Quota/rate-limit/outage
errors leave manual order entry available. Never put GROQ_API_KEY in a
NEXT_PUBLIC variable or frontend config. No key is committed. Missing/disabled
configuration returns a generic unavailable message and does not create an upload.
Restart FastAPI (version 0.8.0), using --no-access-log, and restart Next.js after build.
The long extraction server call has a 75-second transport deadline; configure the
selected Vercel plan/function duration to accommodate this. Images upload directly
to Supabase, avoiding the 4.5 MB Vercel request-body limit. API JSON contains job IDs.

## 4. Synthetic acceptance

Open Quick Order, choose a synthetic PNG/JPEG containing exactly one customer,
CNY amount and rate. Verify a draft appears, inspect/edit all fields, then deliberately
save through the ordinary form. Extraction and Apply Draft must create NO order.
Existing server rounding, account assignment rules, idempotency and order locks apply.
Try provider outage, malformed image and multiple-order screenshot; manual entry
must remain available. Verify successful/failed processing removes the object.

Ticket abuse limits are five/minute and 100/day per owner. Each job permits one
provider call, expires for extraction after ten minutes and stores no draft/image
contents. No automatic provider retry. Signed UPLOAD capability is valid for the
Supabase-defined two hours, so the sweeper also checks objects uploaded late after
job completion. There is no signed read URL or publicly readable screenshot.

Groq requests use Chat Completions, vision and strict Structured Outputs, with
no tools/Files/Batch API. Provider retention is separate from the application's
one-hour cleanup. Review Groq Data Controls before real customer use; local deletion
does not establish provider Zero Data Retention.

## Local tests and limits

- api/: python -m pytest; ruff check app tests; ruff format --check app tests.
- web/: npm test; npm run lint; npm run typecheck; npm run format:check;
  npm run build; npm run check:client-secrets.
- supabase/tests/: npm test (eight migrations, rollback-only synthetic SQL and
  cleanup worker logic). The local runner uses a small Storage schema fixture;
  it does not emulate the hosted Storage HTTP service or scheduler.

A live Groq call, hosted Storage signed-upload behavior and scheduled cleanup
must be verified after configuration. M9 evaluation and accuracy claims are deferred.
