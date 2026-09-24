import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;`);
try {
 for(const path of ['supabase/migrations/202609220001_profiles.sql','supabase/migrations/202609230001_master_data.sql','supabase/tests/master_data.sql']) {
  await db.exec(await readFile(new URL(path,root),'utf8'));
  console.log('PASS',path);
 }
} catch(error) {console.error({message:error.message,code:error.code,detail:error.detail});process.exitCode=1;}
await db.close();
