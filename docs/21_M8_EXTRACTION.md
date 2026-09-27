# M8 screenshot extraction

## Architecture and boundaries

Owner requests one upload ticket. API creates a random UUID job and a signed
Supabase upload URL for its private flat object path. Browser sends the file directly
to Storage; no screenshot bytes pass through a Next.js/Vercel request body. Extract
accepts only a job UUID, never a client URL/path, and atomically claims it once.
The API downloads the owned object, bounds bytes, verifies declared MIME against
PNG/JPEG decode, rejects animation/invalid images and >20 MP. It sends the image
inline to OpenAI Responses (store=false, no tools, no Files API). Provider receives
no customer list, account information, token, transaction history or database access.
OpenAI retention/abuse-monitoring settings are separate; store=false is not a
promise of provider Zero Data Retention. Production privacy review is required.

A provider-independent service validates output using Pydantic, reusing the normal
order amount/rate constraints. Invalid fields become null with fixed warnings;
malformed schemas/refusals/incomplete responses are rejected. Customer matching
uses exact case-insensitive trimmed visible names against the owner-readable active
master; ambiguous candidates require explicit selection. Model-generated IDs and
expected_idr are not accepted. Confidence is displayed as guidance; every draft
requires review. Multiple-order detection clears all fields and disables applying
that draft. Manual Quick Order remains available during provider/cleanup outages.

## API contract

- POST /ai/uploads: {mime_type: image/png|image/jpeg, size_bytes: 1..5000000}.
  Returns {job_id, upload_url}. URL is upload-only for the unique path; no upsert.
- POST /ai/extract-order: {job_id: UUID}. Returns {draft, candidates, confidence,
  warnings, multiple_orders}. Draft has customer_text, matched_customer_id,
  cny_amount, customer_rate (nullable decimal strings). No financial posting.
- DELETE /ai/uploads/{job_id}: owner cancellation; removes the owned image.
- Errors are generic and no-store. No image/provider body, signed URL or key in logs.
- Successful draft application pre-fills the ordinary editable Quick Order form.
  Its explicit save still calls the existing order API with normal idempotency.

## Cleanup and abuse controls

Private bucket isna-ai-temp has a 5 MB limit and PNG/JPEG MIME allowlist. Signed
upload URLs are Supabase's two-hour upload capability; they are never read URLs.
Cleanup enumerates bucket objects, including late uploads using an outstanding
capability, rather than relying only on job records. No public screenshot route.
API finally removes the object on completion/failure; cleanup failures produce an
error and leave it for the independent sweeper. Client cancellation also requests
removal, but does not replace server cleanup.

Supabase Edge cleanup uses its server-only service-role environment credential,
restricted in code to this bucket and cleanup metadata RPC. Schedule every five
minutes. Objects >=45 minutes old are deleted via Storage API, not SQL metadata
removal. This leaves time before the one-hour bound. Cleanup heartbeat is refreshed
only after a successful sweep. New tickets fail closed if heartbeat is >10 minutes
old. Deployment must monitor cleanup failures; no software can promise deletion
while the storage provider is unavailable. Keep feature disabled until scheduler
and heartbeat are verified. API/Next.js do not receive the cleanup service-role key.

Technical abuse limits: five upload tickets/minute and 100/day per owner, enforced
atomically in PostgreSQL; one provider call per job, 60-second provider timeout,
bounded output, no automatic billed retries. These are infrastructure safeguards,
not financial rules. No screenshot/draft contents are stored in job metadata.

## Required tests (specified before implementation)

Synthetic-only tests: owner denial, cross-owner job denial, replay/expiry/quota,
cleanup heartbeat failure, private bucket/policies, valid PNG/JPEG, invalid MIME,
corrupt/animated/oversized/over-pixel files, exactly one input, valid/null/negative/
malformed amount/rate, unexpected financial fields, refusal/incomplete/provider
outage, multiple-order suppression, ambiguous customer match, prompt injection
as data, cleanup after success/failure and orphan sweep threshold. Verify no
financial repository call from extraction; applying draft never writes an order.
User save reuses existing order validation. Secret scan includes OPENAI_API_KEY.
M9 evaluation and quality claims are out of scope.

## Official references

- https://developers.openai.com/api/docs/models/gpt-5.4-mini
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/your-data
- https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
- https://supabase.com/docs/guides/functions/schedule-functions
- https://vercel.com/docs/functions/limitations
