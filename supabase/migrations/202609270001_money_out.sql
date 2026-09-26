begin;
create table public.atm_card_activities (
 id uuid primary key default gen_random_uuid(), account_id uuid references public.accounts on delete restrict,
 business_date date not null check(isfinite(business_date)),
 actual_cny_handled numeric(18,2) not null check(actual_cny_handled>0),
 fee_rate numeric(18,6) not null check(fee_rate>=0),
 calculated_fee_idr numeric(20,2) not null check(calculated_fee_idr>=0),
 fee_status text not null default 'unpaid' check(fee_status in ('unpaid','paid')),
 payment_date date check(isfinite(payment_date)), note text check(length(note)<=2000),
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check((fee_status='paid')=(payment_date is not null)),
 check(calculated_fee_idr=round(actual_cny_handled*fee_rate,2)),
 check(actual_cny_handled::text not in ('NaN','Infinity','-Infinity') and fee_rate::text not in ('NaN','Infinity','-Infinity'))
);
create index atm_activity_date on public.atm_card_activities(business_date,account_id);
create table public.money_out_request_keys (
 user_id uuid not null references public.profiles on delete restrict, operation text not null, key text not null,
 request_json jsonb not null, response_json jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,operation,key)
);
do $$ declare tab text; begin
 foreach tab in array array['atm_card_activities','money_out_request_keys'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
  execute format('create policy owner_read on public.%I for select to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role=''owner''))',tab);
 end loop;
end $$;
alter table public.financial_outflows
 add column replaces_id uuid unique references public.financial_outflows on delete restrict,
 add column void_reason text check(length(btrim(void_reason)) between 1 and 2000),
 add column voided_at timestamptz,
 drop constraint financial_outflows_source_type_source_id_key;
create unique index one_posted_source on public.financial_outflows(source_type,source_id) where status='posted';

-- Numeric validation is repeated in SQL so direct RPC calls cannot bypass FastAPI.
create function private.money_number(p jsonb,k text,places int,bound numeric,positive boolean default false)
returns numeric language plpgsql immutable set search_path='' as $$
declare n numeric; begin
 if not(p ? k) or jsonb_typeof(p->k)<>'string' then raise sqlstate '22023'; end if;
 n=(p->>k)::numeric;
 if n::text in ('NaN','Infinity','-Infinity') or n<0 or (positive and n=0) or n>=bound or n<>round(n,places) then raise sqlstate '22023'; end if;
 return n;
end $$;
revoke all on function private.money_number(jsonb,text,int,numeric,boolean) from public,anon,authenticated;
create function public.mutate_money_out(p_operation text,p_payload jsonb,p_key text,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); scope text; cached public.money_out_request_keys; allowed text[]; k text;
 a public.atm_card_activities; old_a jsonb; old_f public.financial_outflows; f public.financial_outflows;
 result jsonb; amount numeric; cny numeric; rate numeric; day date; cat text; descr text; reason text;
begin
 if not exists(select 1 from public.profiles where id=actor and role='owner') then raise insufficient_privilege; end if;
 if p_operation is null or p_operation not in ('atm_create','atm_edit','atm_pay','create','void','correct')
 or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_key is null or p_key !~ '^[A-Za-z0-9_-]{1,128}$' then raise sqlstate '22023'; end if;
 if (p_operation in ('atm_edit','atm_pay','void','correct')) <> (p_id is not null) then raise sqlstate '22023'; end if;
 allowed=case p_operation
 when 'atm_create' then array['account_id','business_date','actual_cny_handled','fee_rate','calculated_fee_idr','note']
 when 'atm_edit' then array['account_id','business_date','actual_cny_handled','fee_rate','calculated_fee_idr','note','updated_at']
 when 'atm_pay' then array['payment_date','updated_at']
 when 'void' then array['reason','updated_at']
 when 'correct' then array['reason','updated_at','business_date','description','amount_idr','cny_amount','rate_or_fee']
 else array['business_date','category','description','amount_idr','cny_amount','rate_or_fee'] end;
 for k in select jsonb_object_keys(p_payload) loop
  if not(k=any(allowed)) or (jsonb_typeof(p_payload->k)<>'string' and not(k in ('account_id','note') and p_payload->k='null'::jsonb)) then raise sqlstate '22023'; end if;
 end loop;
 scope='money-out:'||p_operation||coalesce(':'||p_id::text,'');
 perform pg_advisory_xact_lock(hashtextextended(actor::text||scope||p_key,0));
 select * into cached from public.money_out_request_keys where user_id=actor and operation=scope and key=p_key;
 if found then
  if cached.request_json<>p_payload then raise sqlstate 'P0001' using message='IDEMPOTENCY_CONFLICT'; end if;
  return cached.response_json;
 end if;
 if p_operation in ('atm_edit','atm_pay') then
  select * into a from public.atm_card_activities where id=p_id for update;
  if not found then raise sqlstate 'P0001' using message='NOT_FOUND'; end if;
  old_a=private.team_json(to_jsonb(a));
 end if;
 if p_operation in ('void','correct') then
  select * into old_f from public.financial_outflows where id=p_id for update;
  if not found then raise sqlstate 'P0001' using message='NOT_FOUND'; end if;
  if old_f.status<>'posted' then raise sqlstate 'P0001' using message='STATE_CONFLICT'; end if;
  if not(p_payload ? 'updated_at') or (p_payload->>'updated_at')::timestamptz<>old_f.updated_at then raise sqlstate 'P0001' using message='STALE_OUTFLOW'; end if;
  reason=btrim(p_payload->>'reason');
  if reason is null or length(reason) not between 1 and 2000 then raise sqlstate '22023'; end if;
  -- Any later validation, insert, audit, or request-key failure rolls back this void.
  update public.financial_outflows set status='voided',void_reason=reason,voided_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_id returning * into f;
  insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json)
  values(actor,'financial_outflows',f.id,p_operation,private.team_json(to_jsonb(old_f)),private.team_json(to_jsonb(f)));
 end if;
 if p_operation in ('atm_create','atm_edit') then
  if p_operation='atm_edit' then
   if a.fee_status='paid' then raise sqlstate 'P0001' using message='ACTIVITY_LOCKED'; end if;
   if not(p_payload ? 'updated_at') or (p_payload->>'updated_at')::timestamptz<>a.updated_at then raise sqlstate 'P0001' using message='STALE_ACTIVITY'; end if;
  end if;
  cny=private.money_number(p_payload,'actual_cny_handled',2,1e16,true);
  rate=private.money_number(p_payload,'fee_rate',6,1e12);
  amount=private.money_number(p_payload,'calculated_fee_idr',2,1e18);
  if amount<>round(cny*rate,2) or not(p_payload ? 'business_date') or p_payload->>'business_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise sqlstate '22023'; end if;
  day=(p_payload->>'business_date')::date;
  if p_operation='atm_create' then
   insert into public.atm_card_activities(account_id,business_date,actual_cny_handled,fee_rate,calculated_fee_idr,note,created_by)
   values((p_payload->>'account_id')::uuid,day,cny,rate,amount,p_payload->>'note',actor) returning * into a;
  else
   update public.atm_card_activities set account_id=(p_payload->>'account_id')::uuid,business_date=day,actual_cny_handled=cny,fee_rate=rate,calculated_fee_idr=amount,note=p_payload->>'note',updated_at=clock_timestamp() where id=p_id returning * into a;
  end if;
 elsif p_operation='atm_pay' then
  if not(p_payload ? 'payment_date') or p_payload->>'payment_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise sqlstate '22023'; end if;
  day=(p_payload->>'payment_date')::date;
  if a.fee_status='paid' then
   if a.payment_date<>day then raise sqlstate 'P0001' using message='STATE_CONFLICT'; end if;
  else
   if not(p_payload ? 'updated_at') or (p_payload->>'updated_at')::timestamptz<>a.updated_at then raise sqlstate 'P0001' using message='STALE_ACTIVITY'; end if;
   insert into public.financial_outflows(business_date,category,description,amount_idr,cny_amount,rate_or_fee,source_type,source_id,created_by)
   values(day,'atm_card_fee','ATM/card fee',a.calculated_fee_idr,a.actual_cny_handled,a.fee_rate,'atm_card_activity',a.id,actor) returning * into f;
   insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,after_json) values(actor,'financial_outflows',f.id,'create',private.team_json(to_jsonb(f)));
   update public.atm_card_activities set fee_status='paid',payment_date=day,updated_at=clock_timestamp() where id=p_id returning * into a;
  end if;
  select f0.* into f from public.financial_outflows f0 where source_type='atm_card_activity' and source_id=a.id and not exists(select 1 from public.financial_outflows child where child.replaces_id=f0.id);
 elsif p_operation in ('create','correct') then
  cat=case when p_operation='correct' then old_f.category else p_payload->>'category' end;
  if cat is null or (p_operation='create' and cat not in ('rmb_purchase','exchange_fee','other')) then raise sqlstate '22023'; end if;
  descr=btrim(p_payload->>'description');
  if descr is null or length(descr) not between 1 and 2000 or not(p_payload ? 'business_date') or p_payload->>'business_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise sqlstate '22023'; end if;
  day=(p_payload->>'business_date')::date;
  amount=private.money_number(p_payload,'amount_idr',2,1e18);
  if cat in ('rmb_purchase','team_fee','atm_card_fee') then
   cny=private.money_number(p_payload,'cny_amount',2,1e16,true);
   rate=private.money_number(p_payload,'rate_or_fee',6,1e12,cat='rmb_purchase');
   if amount<>round(cny*rate,2) then raise sqlstate '22023'; end if;
  elsif p_payload ?| array['cny_amount','rate_or_fee'] then raise sqlstate '22023'; end if;
  insert into public.financial_outflows(business_date,category,description,amount_idr,cny_amount,rate_or_fee,source_type,source_id,replaces_id,created_by)
  values(day,cat,descr,amount,cny,rate,old_f.source_type,old_f.source_id,old_f.id,actor) returning * into f;
  insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,after_json) values(actor,'financial_outflows',f.id,'create',private.team_json(to_jsonb(f)));
 end if;
 if p_operation like 'atm_%' then
  if private.team_json(to_jsonb(a)) is distinct from old_a then
   insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json)
   values(actor,'atm_card_activities',a.id,p_operation,old_a,private.team_json(to_jsonb(a)));
  end if;
  result=jsonb_build_object('activity',private.team_json(to_jsonb(a)),'outflow',case when f.id is null then null else private.team_json(to_jsonb(f)) end);
 else result=private.team_json(to_jsonb(f)); end if;
 insert into public.money_out_request_keys(user_id,operation,key,request_json,response_json) values(actor,scope,p_key,p_payload,result);
 return result;
end $$;
revoke all on function public.mutate_money_out(text,jsonb,text,uuid) from public,anon;
grant execute on function public.mutate_money_out(text,jsonb,text,uuid) to authenticated;

create function public.outflow_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare root_id uuid; ids uuid[]; chain jsonb; audits jsonb; item jsonb; begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='owner') then raise insufficient_privilege; end if;
 select private.team_json(to_jsonb(f)) into item from public.financial_outflows f where id=p_id;
 if not found then raise sqlstate 'P0001' using message='NOT_FOUND'; end if;
 with recursive ancestors as (
  select id,replaces_id from public.financial_outflows where id=p_id
  union all select f.id,f.replaces_id from public.financial_outflows f join ancestors a on f.id=a.replaces_id
 ) select id into root_id from ancestors where replaces_id is null;
 with recursive descendants as (
  select f.*,0 as depth from public.financial_outflows f where id=root_id
  union all select f.*,d.depth+1 from public.financial_outflows f join descendants d on f.replaces_id=d.id
 ) select array_agg(id order by depth),jsonb_agg(private.team_json(to_jsonb(d)-'depth') order by depth) into ids,chain from descendants d;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at,a.id),'[]') into audits from public.audit_logs a where entity_type='financial_outflows' and entity_id=any(ids);
 return jsonb_build_object('outflow',item,'chain',chain,'audit',audits);
end $$;
revoke all on function public.outflow_detail(uuid) from public,anon;
grant execute on function public.outflow_detail(uuid) to authenticated;

-- Preserve M4 API and idempotency history; resolve the current correction chain.
create or replace function public.mutate_team_activity(p_operation text,p_payload jsonb,p_key text,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); scope text; cached public.team_request_keys; allowed text[]; k text;
 activity public.team_daily_activities; old_json jsonb; result jsonb; outflow public.financial_outflows;
 movement public.team_movements; amount numeric; rate numeric; fee numeric; team uuid; day date;
begin
 if not exists(select 1 from public.profiles where id=actor and role='owner') then raise insufficient_privilege; end if;
 if p_operation is null or p_operation not in ('movement','create','edit','pay') or p_payload is null or jsonb_typeof(p_payload)<>'object'
 or p_key is null or p_key !~ '^[A-Za-z0-9_-]{1,128}$' then raise sqlstate '22023'; end if;
 if p_operation in ('edit','pay') and p_id is null then raise sqlstate '22023'; end if;
 allowed=case p_operation when 'movement' then array['team_id','business_date','movement_type','cny_amount','order_id','note']
 when 'pay' then array['payment_date','updated_at'] when 'edit' then array['team_id','business_date','actual_cny_handled','fee_rate','calculated_fee_idr','updated_at']
 else array['team_id','business_date','actual_cny_handled','fee_rate','calculated_fee_idr'] end;
 if exists(select 1 from jsonb_object_keys(p_payload) f where not(f=any(allowed))) then raise sqlstate '22023'; end if;
 for k in select jsonb_object_keys(p_payload) loop
  if jsonb_typeof(p_payload->k)<>'string' and not(k in ('order_id','note') and p_payload->k='null'::jsonb) then raise sqlstate '22023'; end if;
 end loop;
 scope='team:'||p_operation||coalesce(':'||p_id::text,'');
 perform pg_advisory_xact_lock(hashtextextended(actor::text||scope||p_key,0));
 select * into cached from public.team_request_keys where user_id=actor and operation=scope and key=p_key;
 if found then
  if cached.request_json<>p_payload then raise sqlstate 'P0001' using message='IDEMPOTENCY_CONFLICT'; end if;
  return cached.response_json;
 end if;
 if p_operation in ('edit','pay') then
  select * into activity from public.team_daily_activities where id=p_id for update;
  if not found then raise sqlstate 'P0001' using message='NOT_FOUND'; end if;
  old_json=private.team_json(to_jsonb(activity));
 end if;
 if p_operation='pay' then
  if not(p_payload ? 'payment_date') or (p_payload->>'payment_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise sqlstate '22023'; end if;
  day=(p_payload->>'payment_date')::date;
  if activity.fee_status='paid' then
   if activity.payment_date<>day then raise sqlstate 'P0001' using message='STATE_CONFLICT'; end if;
  else
   if not(p_payload ? 'updated_at') or (p_payload->>'updated_at')::timestamptz<>activity.updated_at then raise sqlstate 'P0001' using message='STALE_ACTIVITY'; end if;
   insert into public.financial_outflows(business_date,category,description,amount_idr,cny_amount,rate_or_fee,source_type,source_id,created_by)
   values(day,'team_fee','Team fee',activity.calculated_fee_idr,activity.actual_cny_handled,activity.fee_rate,'team_daily_activity',activity.id,actor) returning * into outflow;
   update public.team_daily_activities set fee_status='paid',payment_date=day,updated_at=clock_timestamp() where id=p_id returning * into activity;
   insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,after_json)
   values(actor,'financial_outflows',outflow.id,'create',private.team_json(to_jsonb(outflow)));
  end if;
  select f0.* into outflow from public.financial_outflows f0 where source_type='team_daily_activity' and source_id=activity.id and not exists(select 1 from public.financial_outflows child where child.replaces_id=f0.id);
  result=jsonb_build_object('activity',private.team_json(to_jsonb(activity)),'outflow',private.team_json(to_jsonb(outflow)));
 elsif p_operation='movement' then
  if not(p_payload ?& array['team_id','business_date','movement_type','cny_amount']) then raise sqlstate '22023'; end if;
  amount=(p_payload->>'cny_amount')::numeric;
  if amount::text in ('NaN','Infinity','-Infinity') or abs(amount)>=1e16 or amount<>round(amount,2) then raise sqlstate '22023'; end if;
  insert into public.team_movements(team_id,business_date,movement_type,cny_amount,order_id,note,created_by)
  values((p_payload->>'team_id')::uuid,(p_payload->>'business_date')::date,p_payload->>'movement_type',amount,(p_payload->>'order_id')::uuid,p_payload->>'note',actor) returning * into movement;
  result=private.team_json(to_jsonb(movement));
  insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,after_json) values(actor,'team_movements',movement.id,'create',result);
 else
  if not(p_payload ?& array['team_id','business_date','actual_cny_handled','fee_rate','calculated_fee_idr']) then raise sqlstate '22023'; end if;
  if p_operation='edit' then
   if activity.fee_status='paid' then raise sqlstate 'P0001' using message='ACTIVITY_LOCKED'; end if;
   if not(p_payload ? 'updated_at') or (p_payload->>'updated_at')::timestamptz<>activity.updated_at then raise sqlstate 'P0001' using message='STALE_ACTIVITY'; end if;
  end if;
  amount=(p_payload->>'actual_cny_handled')::numeric; rate=(p_payload->>'fee_rate')::numeric;
  if amount::text in ('NaN','Infinity','-Infinity') or rate::text in ('NaN','Infinity','-Infinity') or amount<=0 or rate<0 or amount>=1e16 or rate>=1e12 or amount<>round(amount,2) or rate<>round(rate,6) then raise sqlstate '22023'; end if;
  fee=round(amount*rate,2);
  if fee>=1e18 or fee<>(p_payload->>'calculated_fee_idr')::numeric then raise sqlstate '22023'; end if;
  team=(p_payload->>'team_id')::uuid; day=(p_payload->>'business_date')::date;
  if p_operation='create' then
   insert into public.team_daily_activities(team_id,business_date,actual_cny_handled,fee_rate,calculated_fee_idr,created_by)
   values(team,day,amount,rate,fee,actor) returning * into activity;
  else
   update public.team_daily_activities set team_id=team,business_date=day,actual_cny_handled=amount,fee_rate=rate,calculated_fee_idr=fee,updated_at=clock_timestamp() where id=p_id returning * into activity;
  end if;
  result=jsonb_build_object('activity',private.team_json(to_jsonb(activity)),'outflow',null);
 end if;
 if p_operation<>'movement' and private.team_json(to_jsonb(activity)) is distinct from old_json then
  insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json)
  values(actor,'team_daily_activities',activity.id,p_operation,old_json,private.team_json(to_jsonb(activity)));
 end if;
 insert into public.team_request_keys(user_id,operation,key,request_json,response_json) values(actor,scope,p_key,p_payload,result);
 return result;
end $$;
revoke all on function public.mutate_team_activity(text,jsonb,text,uuid) from public,anon;
grant execute on function public.mutate_team_activity(text,jsonb,text,uuid) to authenticated;

create function public.current_fee_outflows(p_source text,p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='owner') then raise insufficient_privilege; end if;
 if p_source is null or p_source not in ('team_daily_activity','atm_card_activity') or p_ids is null or cardinality(p_ids)>100 then raise sqlstate '22023'; end if;
 select coalesce(jsonb_agg(private.team_json(to_jsonb(f))),'[]') into result
 from unnest(p_ids) as src(id) cross join lateral (
 select f0.* from public.financial_outflows f0 where source_type=p_source and source_id=src.id and not exists(select 1 from public.financial_outflows child where child.replaces_id=f0.id)
 ) f;
 return result;
end $$;
revoke all on function public.current_fee_outflows(text,uuid[]) from public,anon;
grant execute on function public.current_fee_outflows(text,uuid[]) to authenticated;
commit;
