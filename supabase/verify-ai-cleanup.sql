-- Administrator, read-only diagnostics. Never select cron.command, secret values,
-- request headers, or raw HTTP response bodies when sharing results.
select to_regclass('public.ai_upload_jobs') is not null as ai_migration_present,
       to_regclass('cron.job') is not null as cron_installed;

-- Run after confirming the AI migration exists:
select last_success,
       coalesce(last_success > now() - interval '10 minutes', false) as heartbeat_fresh
from private.ai_cleanup_state;

-- Run the following ONLY if cron_installed is true:
select jobid, jobname, schedule, active
from cron.job where jobname = 'isna-ai-cleanup';
select d.status, d.start_time, d.end_time
from cron.job_run_details d join cron.job j using (jobid)
where j.jobname = 'isna-ai-cleanup'
order by d.start_time desc limit 10;

-- Cron success means the HTTP request was queued, NOT that cleanup succeeded.
-- Verify Edge Function deployment, successful HTTP invocations and heartbeat,
-- plus synthetic orphan disappearance, separately before enabling AI.
