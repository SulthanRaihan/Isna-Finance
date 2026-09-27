begin;
create table public.ai_upload_jobs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 mime_type text not null check(mime_type in ('image/png','image/jpeg')),
 size_bytes integer not null check(size_bytes between 1 and 5000000),
 status text not null default 'ready' check(status in ('ready','processing','finished')),
 created_at timestamptz not null default clock_timestamp()
);
create index ai_upload_owner_time on public.ai_upload_jobs(owner_id,created_at);
alter table public.ai_upload_jobs enable row level security;
alter table public.ai_upload_jobs force row level security;
revoke all on public.ai_upload_jobs from public,anon,authenticated;
grant select on public.ai_upload_jobs to authenticated;
create policy owner_read on public.ai_upload_jobs for select to authenticated using
(owner_id=(select auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and role='owner'));
create table private.ai_cleanup_state(singleton boolean primary key default true check(singleton), last_success timestamptz);
insert into private.ai_cleanup_state(singleton) values(true);

create function public.ai_upload_job(p_action text,p_id uuid default null,p_mime text default null,p_size int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ai_upload_jobs; begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='owner') then raise insufficient_privilege; end if;
 if p_action is null or p_action not in ('create','claim','finish','read') then raise sqlstate '22023'; end if;
 if p_action='create' then
  perform pg_advisory_xact_lock(20260928,8);
  if not exists(select 1 from private.ai_cleanup_state where last_success>clock_timestamp()-interval '10 minutes') then raise sqlstate 'P0001' using message='AI_CLEANUP_UNAVAILABLE'; end if;
  if (select count(*) from public.ai_upload_jobs where owner_id=auth.uid() and created_at>clock_timestamp()-interval '1 minute')>=5
   or (select count(*) from public.ai_upload_jobs where owner_id=auth.uid() and created_at>clock_timestamp()-interval '24 hours')>=100 then raise sqlstate 'P0001' using message='AI_RATE_LIMIT'; end if;
  insert into public.ai_upload_jobs(owner_id,mime_type,size_bytes) values(auth.uid(),p_mime,p_size) returning * into j;
 else
  select * into j from public.ai_upload_jobs where id=p_id and owner_id=auth.uid() for update;
  if not found then raise sqlstate 'P0001' using message='NOT_FOUND'; end if;
  if p_action='claim' then
   if j.status<>'ready' or j.created_at<clock_timestamp()-interval '10 minutes' then raise sqlstate 'P0001' using message='AI_JOB_UNAVAILABLE'; end if;
   update public.ai_upload_jobs set status='processing' where id=j.id;
  elsif p_action='finish' then update public.ai_upload_jobs set status='finished' where id=j.id;
  elsif p_action<>'read' then raise sqlstate '22023'; end if;
 end if;
 return to_jsonb(j)||jsonb_build_object('object_path',j.id::text||case j.mime_type when 'image/png' then '.png' else '.jpg' end);
end $$;
revoke all on function public.ai_upload_job(text,uuid,text,int) from public,anon;
grant execute on function public.ai_upload_job(text,uuid,text,int) to authenticated;

-- Only the independent cleanup worker receives this capability.
create function public.ai_cleanup_heartbeat() returns void language plpgsql security definer set search_path='' as $$
begin
 update private.ai_cleanup_state set last_success=clock_timestamp() where singleton;
 delete from public.ai_upload_jobs where created_at<clock_timestamp()-interval '25 hours';
end $$;
revoke all on function public.ai_cleanup_heartbeat() from public,anon,authenticated;
grant execute on function public.ai_cleanup_heartbeat() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('isna-ai-temp','isna-ai-temp',false,5000000,array['image/png','image/jpeg']);
create policy ai_temp_insert on storage.objects for insert to authenticated with check(
 bucket_id='isna-ai-temp' and exists(select 1 from public.ai_upload_jobs j where j.owner_id=auth.uid() and j.status='ready' and j.created_at>now()-interval '10 minutes' and name=j.id::text||case j.mime_type when 'image/png' then '.png' else '.jpg' end));
create policy ai_temp_read on storage.objects for select to authenticated using(
 bucket_id='isna-ai-temp' and exists(select 1 from public.ai_upload_jobs j where j.owner_id=auth.uid() and name=j.id::text||case j.mime_type when 'image/png' then '.png' else '.jpg' end));
create policy ai_temp_delete on storage.objects for delete to authenticated using(
 bucket_id='isna-ai-temp' and exists(select 1 from public.ai_upload_jobs j where j.owner_id=auth.uid() and name=j.id::text||case j.mime_type when 'image/png' then '.png' else '.jpg' end));
commit;
