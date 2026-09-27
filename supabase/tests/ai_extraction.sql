begin;
insert into auth.users(id,email) values ('80000000-0000-4000-8000-000000000001','ai-owner@synthetic.test'),('80000000-0000-4000-8000-000000000002','ai-other@synthetic.test');
insert into public.profiles(id,display_name,role) values ('80000000-0000-4000-8000-000000000001','Synthetic Owner','owner'),('80000000-0000-4000-8000-000000000002','Synthetic Developer','developer');
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
do $$ begin
 begin perform public.ai_upload_job('create',null,'image/png',50); raise exception 'Missing heartbeat allowed'; exception when sqlstate 'P0001' then if sqlerrm<>'AI_CLEANUP_UNAVAILABLE' then raise; end if; end;
end $$;
reset role;
select public.ai_cleanup_heartbeat();
set local role authenticated;
do $$ declare j jsonb; i int; begin
 j=public.ai_upload_job('create',null,'image/png',50);
 insert into storage.objects(bucket_id,name) values ('isna-ai-temp',j->>'object_path');
 begin insert into storage.objects(bucket_id,name) values ('isna-ai-temp','not-owned.png'); raise exception 'Arbitrary upload allowed'; exception when insufficient_privilege then null; end;
 perform public.ai_upload_job('claim',(j->>'id')::uuid);
 begin perform public.ai_upload_job('claim',(j->>'id')::uuid); raise exception 'Replay allowed'; exception when sqlstate 'P0001' then if sqlerrm<>'AI_JOB_UNAVAILABLE' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
 if exists(select 1 from public.ai_upload_jobs) or exists(select 1 from storage.objects) then raise exception 'Other user can read upload'; end if;
 begin perform public.ai_upload_job('read',(j->>'id')::uuid); raise exception 'Other user job access'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
 delete from storage.objects where name=j->>'object_path';
 perform public.ai_upload_job('finish',(j->>'id')::uuid);
 for i in 1..4 loop perform public.ai_upload_job('create',null,'image/jpeg',100); end loop;
 begin perform public.ai_upload_job('create',null,'image/jpeg',100); raise exception 'Rate limit bypass'; exception when sqlstate 'P0001' then if sqlerrm<>'AI_RATE_LIMIT' then raise; end if; end;
 begin perform public.ai_cleanup_heartbeat(); raise exception 'Owner can forge heartbeat'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Expired jobs cannot be reclaimed even when the cleanup heartbeat is current.
update public.ai_upload_jobs set created_at=clock_timestamp()-interval '11 minutes';
set local role authenticated;
do $$ declare j uuid; begin
 select id into j from public.ai_upload_jobs where status='ready' limit 1;
 begin perform public.ai_upload_job('claim',j); raise exception 'Expired job allowed';
 exception when sqlstate 'P0001' then if sqlerrm<>'AI_JOB_UNAVAILABLE' then raise; end if; end;
end $$;
reset role;
update private.ai_cleanup_state set last_success=clock_timestamp()-interval '11 minutes';
set local role authenticated;
do $$ begin
 begin perform public.ai_upload_job('create',null,'image/png',50); raise exception 'Stale heartbeat allowed';
 exception when sqlstate 'P0001' then if sqlerrm<>'AI_CLEANUP_UNAVAILABLE' then raise; end if; end;
end $$;
reset role;
select public.ai_cleanup_heartbeat();
insert into public.ai_upload_jobs(owner_id,mime_type,size_bytes,created_at)
select '80000000-0000-4000-8000-000000000001','image/png',50,clock_timestamp()-interval '2 hours' from generate_series(1,100);
set local role authenticated;
do $$ begin
 begin perform public.ai_upload_job('create',null,'image/png',50); raise exception 'Daily quota allowed';
 exception when sqlstate 'P0001' then if sqlerrm<>'AI_RATE_LIMIT' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from storage.buckets where id='isna-ai-temp' and not public and file_size_limit=5000000 and allowed_mime_types=array['image/png','image/jpeg']) then raise exception 'Unsafe bucket'; end if;
 if exists(select 1 from public.orders) or exists(select 1 from public.financial_outflows) then raise exception 'AI wrote financial records'; end if;
end $$;
rollback;
