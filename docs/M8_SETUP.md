# M8 setup: screenshot draft extraction

M8 remains disabled until all steps below succeed. Manual Quick Order works without
OpenAI. No migration or Edge Function deployment has been performed by the agent.

## 1. Database and Storage

Run `supabase/migrations/202609280001_ai_extraction.sql` once after M7, as administrator
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
OPENAI_API_KEY=<enter privately in the environment>
OPENAI_MODEL=gpt-5.4-mini
AI_EXTRACTION_ENABLED=true
```

Only set enabled=true after cleanup verification. Never put OPENAI_API_KEY in a
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

OpenAI requests use Responses, vision, strict Structured Outputs, store=false and
no tools/Files API. Provider retention and abuse monitoring are separate from the
application's one-hour cleanup. Review OpenAI project privacy settings before real
customer use; do not claim Zero Data Retention from store=false alone.

## Local tests and limits

- api/: python -m pytest; ruff check app tests; ruff format --check app tests.
- web/: npm test; npm run lint; npm run typecheck; npm run format:check;
  npm run build; npm run check:client-secrets.
- supabase/tests/: npm test (eight migrations, rollback-only synthetic SQL and
  cleanup worker logic). The local runner uses a small Storage schema fixture;
  it does not emulate the hosted Storage HTTP service or scheduler.

A live OpenAI call, hosted Storage signed-upload behavior and scheduled cleanup
must be verified after configuration. M9 evaluation and accuracy claims are deferred.
