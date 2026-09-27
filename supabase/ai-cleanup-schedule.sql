-- Run AFTER deploying ai-cleanup and storing these exact Vault secrets:
-- project_url = https://<project>.supabase.co ; ai_cleanup_secret = worker secret.
-- Secrets are provisioned through the dashboard; never place values in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('isna-ai-cleanup','*/5 * * * *', $$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/ai-cleanup',
  headers := jsonb_build_object('Content-Type','application/json','x-cleanup-secret',(select decrypted_secret from vault.decrypted_secrets where name='ai_cleanup_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 55000
 );
$$);
