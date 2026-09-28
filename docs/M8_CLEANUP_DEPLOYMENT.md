# M8 cleanup deployment progress

Date: 2026-09-28. M8 only; AI remains disabled.

## Completed

- Deployed ai-cleanup through the authenticated Supabase dashboard.
- Verified both editor files against the repository source before deployment.
- Configured verify_jwt=false as in supabase/config.toml; the function still
  requires its own AI_CLEANUP_SECRET header and denies missing configuration.
- Verified an unauthenticated POST returns HTTP 401 with an empty body. This
  confirms deployment and denial behavior, not successful authenticated cleanup.
- User privately provisioned AI_CLEANUP_SECRET and the matching ai_cleanup_secret
  in Vault. project_url is also configured. Secret values were not read or committed.
- Applied supabase/ai-cleanup-schedule.sql once. Confirmed job ID 1, name
  isna-ai-cleanup, schedule */5 * * * *, active=true.
- Confirmed authenticated scheduled success: last_success
  2026-09-28 11:30:00.561264+00, heartbeat_fresh=true.
- Uploaded one synthetic 3,941-byte PNG orphan,
  80000000-0000-4000-8000-000000000008.png. Adjusted only its created_at to
  2026-09-28 10:50:06.866922+00 (46 minutes old at test setup) to test retention
  without waiting 45 minutes. No storage metadata was deleted by SQL.

- Scheduled run at 2026-09-28 11:40:02.251111+00 refreshed the heartbeat and
  removed the fixture through the deployed Storage API cleanup path. At
  11:40:14.573345+00, synthetic_orphans_remaining=0 and heartbeat_fresh=true.
  The Storage dashboard independently showed the bucket empty.
- This is an accelerated-age integration test: the fixture was treated as about
  50 minutes old when deleted. It is not an hour-long wall-clock observation or
  a guarantee during infrastructure outages.

- pg_net responses for 11:30, 11:35 and 11:40 UTC each returned HTTP 200
  with timed_out=false (request IDs 56, 57 and 58). No headers, response bodies
  or secret values were exposed in the verification query.

## Pending

1. Verify Groq Free billing and privately configure a rotated Groq key before
   enabling AI or running synthetic live extraction.

Authenticated scheduled cleanup and accelerated-age orphan deletion have passed.
Groq key remains absent locally, and the Billing page requires user login. AI
remains disabled until all activation requirements pass. Live Groq extraction and
application signed-upload/immediate-deletion acceptance are not yet verified.

No application code or financial rules changed during this deployment. Prior
183 API tests, 66 frontend tests and build results belong to commit 74058c0;
this deployment adds live denial, scheduler, heartbeat and orphan-deletion checks.
