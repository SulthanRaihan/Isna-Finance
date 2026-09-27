import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
alter table storage.objects force row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;`);
try {
 for(const path of ['supabase/migrations/202609220001_profiles.sql','supabase/migrations/202609230001_master_data.sql','supabase/migrations/202609250001_orders.sql','supabase/migrations/202609260001_team_activity.sql','supabase/migrations/202609270001_money_out.sql','supabase/migrations/202609270002_reporting.sql','supabase/migrations/202609270003_security.sql','supabase/migrations/202609280001_ai_extraction.sql','supabase/tests/ai_extraction.sql','supabase/tests/security.sql','supabase/tests/reporting.sql','supabase/tests/money_out.sql','supabase/tests/team_activity.sql','supabase/tests/master_data.sql','supabase/tests/orders.sql']) {
  await db.exec(await readFile(new URL(path,root),'utf8'));
  console.log('PASS',path);
 }
} catch(error) {console.error({message:error.message,code:error.code,detail:error.detail});process.exitCode=1;}
await db.close();
