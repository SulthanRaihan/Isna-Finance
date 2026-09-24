-- Run only in an EMPTY disposable development database after M1 and M2 migrations.
-- Never against an existing owner/profile; all synthetic inserts roll back.
begin;
do $$ begin
 if exists(select 1 from public.profiles) then raise exception 'Use an empty disposable database'; end if;
end $$;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','owner@example.test'),
 ('10000000-0000-4000-8000-000000000002','developer@example.test');
insert into public.profiles(id,display_name,role) values
 ('10000000-0000-4000-8000-000000000001','Synthetic Owner','owner'),
 ('10000000-0000-4000-8000-000000000002','Synthetic Developer','developer');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.accounts(id,label,bank_name,country_code,account_last4) values
 ('20000000-0000-4000-8000-000000000001','Synthetic A','Demo','ID','1234'),
 ('20000000-0000-4000-8000-000000000002','Synthetic B','Demo','ID','5678');
insert into public.customers(display_name) values ('Synthetic Customer');
insert into public.teams(name,default_fee_rate) values ('Synthetic Team','1.700001');

do $$ declare today date; details text; before_count int;
begin
 today=(public.business_context()->>'business_date')::date;
 perform public.replace_daily_accounts(today,array['20000000-0000-4000-8000-000000000001'::uuid],'20000000-0000-4000-8000-000000000001');
 perform public.replace_daily_accounts(today+1,array['20000000-0000-4000-8000-000000000001'::uuid],null);
 perform public.replace_daily_accounts(today-1,array['20000000-0000-4000-8000-000000000001'::uuid],'20000000-0000-4000-8000-000000000001');
 begin
  update public.accounts set is_active=false where id='20000000-0000-4000-8000-000000000001';
  raise exception 'TEST_FAILED: assigned account deactivated' using errcode='ZX001';
 exception when sqlstate 'P0001' then
  get stacked diagnostics details=PG_EXCEPTION_DETAIL;
  if jsonb_array_length(details::jsonb)<>2 then raise exception 'TEST_FAILED: incomplete conflicts'; end if;
 end;
 if not (select is_active from public.accounts where id='20000000-0000-4000-8000-000000000001') then raise exception 'TEST_FAILED: account changed'; end if;
 if not exists(select 1 from public.daily_account_assignments where business_date=today and is_default and account_id='20000000-0000-4000-8000-000000000001') then raise exception 'TEST_FAILED: default changed'; end if;
 -- Invalid replacement must not erase existing assignments.
 begin
  perform public.replace_daily_accounts(today,array['20000000-0000-4000-8000-000000000001'::uuid],'20000000-0000-4000-8000-000000000002');
  raise exception 'TEST_FAILED: invalid default accepted' using errcode='ZX001';
 exception when sqlstate '22023' then null; end;
 if (select count(*) from public.daily_account_assignments where business_date=today)<>1 then raise exception 'TEST_FAILED: replacement not atomic'; end if;
 -- Resolve both conflicts explicitly. Past assignment remains intact.
 perform public.replace_daily_accounts(today,array['20000000-0000-4000-8000-000000000002'::uuid],'20000000-0000-4000-8000-000000000002');
 perform public.replace_daily_accounts(today+1,array[]::uuid[],null);
 update public.accounts set is_active=false where id='20000000-0000-4000-8000-000000000001';
 if not exists(select 1 from public.daily_account_assignments where business_date=today-1 and account_id='20000000-0000-4000-8000-000000000001' and is_default) then raise exception 'TEST_FAILED: history changed'; end if;
 begin
  perform public.replace_daily_accounts(today,array['20000000-0000-4000-8000-000000000001'::uuid],null);
  raise exception 'TEST_FAILED: inactive assignment allowed' using errcode='ZX001';
 exception when sqlstate '22023' then null; end;
 begin
  delete from public.accounts;
  raise exception 'TEST_FAILED: account hard-delete allowed' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.daily_account_assignments(business_date,account_id) values(today,'20000000-0000-4000-8000-000000000001');
  raise exception 'TEST_FAILED: direct assignment write allowed' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.accounts)<>0 then raise exception 'TEST_FAILED: developer read allowed'; end if;
 begin
  insert into public.customers(display_name) values('Unauthorized');
  raise exception 'TEST_FAILED: developer write allowed' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
 begin
  perform public.replace_daily_accounts(current_date,array[]::uuid[],null);
  raise exception 'TEST_FAILED: developer RPC allowed' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform * from public.accounts;
  raise exception 'TEST_FAILED: anonymous read allowed' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
