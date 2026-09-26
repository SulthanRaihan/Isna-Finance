-- Synthetic fixtures only, disposable empty database; transaction rolls back.
begin;
do $$ begin if exists(select 1 from public.profiles) then raise exception 'Use empty database'; end if; end $$;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','owner@example.test'),('10000000-0000-4000-8000-000000000002','developer@example.test');
insert into public.profiles(id,display_name,role) values('10000000-0000-4000-8000-000000000001','Synthetic','owner'),('10000000-0000-4000-8000-000000000002','Synthetic developer','developer');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.teams(id,name) values('20000000-0000-4000-8000-000000000001','Synthetic team');
do $$ declare a jsonb; r jsonb; c jsonb; p jsonb; original jsonb; cat text; aid uuid; oid uuid; n int; begin
 a=public.mutate_money_out('atm_create','{"business_date":"2020-01-01","actual_cny_handled":"5600","fee_rate":"1.7","calculated_fee_idr":"9520.00"}','atm');
 aid=(a->'activity'->>'id')::uuid;
 if a->'activity'->>'fee_status'<>'unpaid' or exists(select 1 from public.financial_outflows) then raise exception 'Premature ATM posting'; end if;
 p=jsonb_build_object('payment_date','2020-01-03','updated_at',a->'activity'->>'updated_at');
 r=public.mutate_money_out('atm_pay',p,'pay',aid);
 if r->'outflow'->>'amount_idr'<>'9520.00' or r->'outflow'->>'business_date'<>'2020-01-03' then raise exception 'Wrong ATM fee/date'; end if;
 n=(select count(*) from public.audit_logs);
 if public.mutate_money_out('atm_pay',p,'pay',aid)<>r then raise exception 'Replay changed'; end if;
 perform public.mutate_money_out('atm_pay',p,'pay-again',aid);
 if (select count(*) from public.audit_logs)<>n then raise exception 'Duplicate audit'; end if;
 begin perform public.mutate_money_out('atm_edit',jsonb_build_object('updated_at',a->'activity'->>'updated_at','business_date','2020-01-01','actual_cny_handled','1','fee_rate','1','calculated_fee_idr','1'),'locked',aid); raise exception 'Paid edit allowed' using errcode='ZX001'; exception when sqlstate 'P0001' then if sqlerrm<>'ACTIVITY_LOCKED' then raise; end if; end;
 a=public.mutate_team_activity('create','{"team_id":"20000000-0000-4000-8000-000000000001","business_date":"2020-01-01","actual_cny_handled":"1","fee_rate":"100.005","calculated_fee_idr":"100.01"}','team');
 perform public.mutate_team_activity('pay',jsonb_build_object('payment_date','2020-01-03','updated_at',a->'activity'->>'updated_at'),'team-pay',(a->'activity'->>'id')::uuid);
 foreach cat in array array['rmb_purchase','exchange_fee','other','team_fee','atm_card_fee'] loop
  if cat in ('team_fee','atm_card_fee') then select private_dummy into original from (select to_jsonb(f) private_dummy from public.financial_outflows f where category=cat and status='posted') t;
  else
   p=jsonb_build_object('business_date','2020-01-03','category',cat,'description','Synthetic expense','amount_idr','10.00');
   if cat='rmb_purchase' then p=p||'{"cny_amount":"2","rate_or_fee":"5"}'; end if;
   original=public.mutate_money_out('create',p,'create-'||cat);
  end if;
  oid=(original->>'id')::uuid;
  p=jsonb_build_object('reason','Synthetic correction','updated_at',original->>'updated_at','business_date','2020-01-04','description','Synthetic replacement','amount_idr','100.01');
  if cat in ('rmb_purchase','team_fee','atm_card_fee') then p=p||'{"cny_amount":"1","rate_or_fee":"100.005"}'; end if;
  n=(select count(*) from public.audit_logs);
  begin perform public.mutate_money_out('correct',p||'{"amount_idr":"-1"}','bad-'||cat,oid); raise exception 'Bad correction accepted' using errcode='ZX001'; exception when sqlstate '22023' then null; end;
  if (select status from public.financial_outflows where id=oid)<>'posted' or (select count(*) from public.audit_logs)<>n then raise exception 'Rollback failed'; end if;
  c=public.mutate_money_out('correct',p,'correct-'||cat,oid);
  if c->>'source_type' is distinct from original->>'source_type' or c->>'source_id' is distinct from original->>'source_id' or c->>'replaces_id'<>oid::text or c->>'amount_idr'<>'100.01' or (select status from public.financial_outflows where id=oid)<>'voided' then raise exception 'Correction failed'; end if;
  if public.mutate_money_out('correct',p,'correct-'||cat,oid)<>c then raise exception 'Correction replay failed'; end if;
  begin perform public.mutate_money_out('correct',p,'branch-'||cat,oid); raise exception 'Branch allowed' using errcode='ZX001'; exception when sqlstate 'P0001' then if sqlerrm<>'STATE_CONFLICT' then raise; end if; end;
  r=public.outflow_detail(oid);
  if jsonb_array_length(r->'chain')<>2 then raise exception 'Missing chain'; end if;
  p=jsonb_build_object('reason','Synthetic invalidation, not refund','updated_at',c->>'updated_at');
  r=public.mutate_money_out('void',p,'void-'||cat,(c->>'id')::uuid);
  if r->>'status'<>'voided' or exists(select 1 from public.financial_outflows where category=cat and status='posted') then raise exception 'Void contributes to money out'; end if;
 end loop;
 r=public.mutate_money_out('atm_pay',jsonb_build_object('payment_date','2020-01-03','updated_at',clock_timestamp()::text),'after-void',aid);
 if r->'outflow'->>'status'<>'voided' then raise exception 'Reposted voided ATM'; end if;
 if public.current_fee_outflows('atm_card_activity',array[aid])->0->>'id' is distinct from r->'outflow'->>'id' then raise exception 'Wrong current posting'; end if;
 r=public.mutate_team_activity('pay','{"payment_date":"2020-01-03"}','after-void',(a->'activity'->>'id')::uuid);
 if r->'outflow'->>'status'<>'voided' or r->'outflow'->>'replaces_id' is null then raise exception 'M4 lookup failed'; end if;
 begin delete from public.financial_outflows; raise exception 'Direct deletion allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.atm_card_activities) or exists(select 1 from public.financial_outflows) then raise exception 'Developer read allowed'; end if;
 begin perform public.mutate_money_out('create','{}','denied'); raise exception 'Developer mutation allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;

reset role;
create function public.synthetic_fail_audit() returns trigger language plpgsql as $$ begin
 if new.entity_type='financial_outflows' and new.after_json->>'description'='Synthetic force audit failure' then raise exception 'Synthetic failure' using errcode='ZX002'; end if; return new;
end $$;
create trigger synthetic_audit_failure before insert on public.audit_logs for each row execute function public.synthetic_fail_audit();
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; c jsonb; p jsonb; n int; keys int; oid uuid; begin
 r=public.mutate_money_out('create','{"business_date":"2020-01-01","category":"other","description":"Synthetic atomic","amount_idr":"2.00"}','atomic-create'); oid=(r->>'id')::uuid;
 n=(select count(*) from public.audit_logs); keys=(select count(*) from public.money_out_request_keys);
 p=jsonb_build_object('reason','Synthetic failure test','updated_at',r->>'updated_at','business_date','2020-01-02','description','Synthetic force audit failure','amount_idr','3.00');
 begin perform public.mutate_money_out('correct',p,'atomic-fail',oid); raise exception 'Audit failure not injected' using errcode='ZX001'; exception when sqlstate 'ZX002' then null; end;
 if (select status from public.financial_outflows where id=oid)<>'posted' or exists(select 1 from public.financial_outflows where replaces_id=oid) or (select count(*) from public.audit_logs)<>n or (select count(*) from public.money_out_request_keys)<>keys then raise exception 'Partial correction persisted'; end if;
 begin perform public.mutate_money_out('void',jsonb_build_object('reason','  ','updated_at',r->>'updated_at'),'blank',oid); raise exception 'Blank reason allowed' using errcode='ZX001'; exception when sqlstate '22023' then null; end;
 begin perform public.mutate_money_out('void','{"reason":"Synthetic","updated_at":"2000-01-01T00:00:00Z"}','stale',oid); raise exception 'Stale void allowed' using errcode='ZX001'; exception when sqlstate 'P0001' then if sqlerrm<>'STALE_OUTFLOW' then raise; end if; end;
 c=public.mutate_money_out('correct',p||'{"description":"Synthetic successful retry"}','atomic-fail',oid);
 p=p||jsonb_build_object('updated_at',c->>'updated_at','description','Synthetic second correction');
 c=public.mutate_money_out('correct',p,'second',(c->>'id')::uuid);
 if jsonb_array_length(public.outflow_detail(oid)->'chain')<>3 then raise exception 'Incomplete multi-step chain'; end if;
 begin update public.atm_card_activities set fee_status='unpaid'; raise exception 'Direct ATM update allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.outflow_detail('10000000-0000-4000-8000-000000000001'); raise exception 'Anonymous detail allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform public.mutate_money_out('create','{}','anon'); raise exception 'Anonymous mutation allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;

rollback;
