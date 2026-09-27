begin;
insert into auth.users(id,email) values
 ('90000000-0000-4000-8000-000000000001','owner@synthetic.test'),
 ('90000000-0000-4000-8000-000000000002','developer@synthetic.test'),
 ('90000000-0000-4000-8000-000000000003','operator@synthetic.test');
insert into public.profiles(id,display_name,role) values
 ('90000000-0000-4000-8000-000000000001','Synthetic Owner','owner'),
 ('90000000-0000-4000-8000-000000000002','Synthetic Developer','developer'),
 ('90000000-0000-4000-8000-000000000003','Synthetic Operator','operator');
insert into public.customers(display_name) values ('Synthetic private customer');
insert into public.audit_logs(actor_user_id,entity_type,entity_id,action)
 values ('90000000-0000-4000-8000-000000000001','synthetic','90000000-0000-4000-8000-000000000001','test');

do $$ declare t record; f record; total int:=0; begin
 for t in select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' loop
  total:=total+1;
  if not t.relrowsecurity or not t.relforcerowsecurity then raise exception 'RLS missing: %',t.relname; end if;
  if has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Anonymous privilege: %',t.relname; end if;
  if has_table_privilege('authenticated',t.oid,'DELETE,TRUNCATE') then raise exception 'Destructive privilege: %',t.relname; end if;
  if t.relname not in ('customers','accounts','teams') and has_table_privilege('authenticated',t.oid,'INSERT,UPDATE') then raise exception 'Direct protected write: %',t.relname; end if;
 end loop;
 if total<>15 then raise exception 'Review changed table inventory: %',total; end if;
 total:=0;
 for f in select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop
  total:=total+1;
  if has_function_privilege('anon',f.oid,'EXECUTE') then raise exception 'Anonymous RPC: %',f.proname; end if;
  if not ('search_path=""'=any(f.proconfig)) then raise exception 'Unsafe RPC search path: %',f.proname; end if;
 end loop;
 if total<>9 then raise exception 'Review changed RPC inventory: %',total; end if;
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' loop
  if has_function_privilege('authenticated',f.oid,'EXECUTE') or has_function_privilege('anon',f.oid,'EXECUTE') then raise exception 'Private helper exposed: %',f.proname; end if;
 end loop;
end $$;

set local role authenticated;
do $$ declare subject text; t record; n int; call_sql text; begin
 foreach subject in array array['90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003'] loop
  perform set_config('request.jwt.claim.sub',subject,true);
  for t in select tablename from pg_tables where schemaname='public' loop
   execute format('select count(*) from public.%I',t.tablename) into n;
   if n<>0 then raise exception 'Non-owner read: %',t.tablename; end if;
  end loop;
  foreach call_sql in array array[
   'select public.business_context()',
   'select public.replace_daily_accounts(null,null,null)',
   'select public.mutate_order(null,null,null,null,null)',
   'select public.mutate_team_activity(null,null,null,null)',
   'select public.team_ledger(null,null,20,0)',
   'select public.mutate_money_out(null,null,null,null)',
   'select public.outflow_detail(null)',
   'select public.current_fee_outflows(null,null)',
   'select public.daily_report(null,''orders'',20,0)'
  ] loop
   begin execute call_sql; raise exception 'Non-owner RPC allowed: %',call_sql;
   exception when insufficient_privilege then null; end;
  end loop;
  begin insert into public.customers(display_name) values ('denied'); raise exception 'Non-owner write allowed'; exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
 select count(*) into n from public.audit_logs;
 if n<>1 then raise exception 'Owner audit read failed'; end if;
 begin update public.audit_logs set action='tampered'; raise exception 'Audit update allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.audit_logs; raise exception 'Audit delete allowed'; exception when insufficient_privilege then null; end;
 begin update public.profiles set role='owner'; raise exception 'Role mutation allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
