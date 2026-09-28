# M8 cleanup deployment progress

Date: 2026-09-28. M8 only; AI remains disabled.

## Completed

- Deployed ai-cleanup through the authenticated Supabase dashboard.
- Verified both editor files against the repository source before deployment.
- Configured verify_jwt=false as in supabase/config.toml; the function still
  requires its own AI_CLEANUP_SECRET header and denies missing configuration.
- Verified an unauthenticated POST returns HTTP 401 with an empty body. This
  confirms deployment and denial behavior, not successful authenticated cleanup.
- Dashboard showed no custom secrets. Prepared the AI_CLEANUP_SECRET name for
  private user entry; no secret value was generated, copied or committed.

## Pending

1. User privately provisions AI_CLEANUP_SECRET in Edge Function Secrets.
2. Store the same value as ai_cleanup_secret in Vault, plus project_url.
3. Install/run the five-minute schedule from supabase/ai-cleanup-schedule.sql.
4. Verify authenticated invocation, cron HTTP success, fresh heartbeat and actual
   removal of a synthetic orphan by Storage API within the one-hour limit.
5. Verify Groq Free billing and privately configure a rotated Groq key before
   enabling AI or running synthetic live extraction.

No authenticated sweep or orphan-retention acceptance has passed yet. Do not
label cleanup operational or enable extraction based on deployment alone.

No application code or financial rules changed during this deployment. Prior
183 API tests, 66 frontend tests and build results belong to commit 74058c0;
this deployment adds the live unauthenticated-denial check only.
