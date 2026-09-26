begin;
create table public.team_movements (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams on delete restrict,
 business_date date not null check(isfinite(business_date)),
 movement_type text not null check(movement_type in ('received','distributed','adjustment')),
 cny_amount numeric(18,2) not null,
 order_id uuid references public.orders on delete restrict,
 note text check(length(note)<=2000),
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 check(cny_amount::text not in ('NaN','Infinity','-Infinity')),
 check(movement_type='adjustment' or cny_amount>0)
);
create index team_movements_date on public.team_movements(team_id,business_date,created_at);
create index team_movements_order on public.team_movements(order_id);
create table public.team_daily_activities (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams on delete restrict,
 business_date date not null check(isfinite(business_date)),
 actual_cny_handled numeric(18,2) not null check(actual_cny_handled>0),
 fee_rate numeric(18,6) not null check(fee_rate>=0),
 calculated_fee_idr numeric(20,2) not null check(calculated_fee_idr>=0),
 fee_status text not null default 'unpaid' check(fee_status in ('unpaid','paid')),
 payment_date date check(isfinite(payment_date)),
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(team_id,business_date),
 check((fee_status='paid')=(payment_date is not null)),
 check(calculated_fee_idr=round(actual_cny_handled*fee_rate,2)),
 check(actual_cny_handled::text not in ('NaN','Infinity','-Infinity') and fee_rate::text not in ('NaN','Infinity','-Infinity'))
);
create table public.financial_outflows (
 id uuid primary key default gen_random_uuid(), business_date date not null check(isfinite(business_date)),
 category text not null check(category in ('rmb_purchase','team_fee','atm_card_fee','exchange_fee','other')),
 description text not null, amount_idr numeric(20,2) not null check(amount_idr>=0),
 cny_amount numeric(18,2), rate_or_fee numeric(18,6), source_type text, source_id uuid,
 status text not null default 'posted' check(status in ('posted','voided')),
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check((source_type is null)=(source_id is null)),
 check(amount_idr::text not in ('NaN','Infinity','-Infinity')),
 unique(source_type,source_id)
);
create index financial_outflows_date on public.financial_outflows(business_date,status);
create table public.team_request_keys (
 user_id uuid not null references public.profiles on delete restrict,
 operation text not null, key text not null,
 request_json jsonb not null, response_json jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(user_id,operation,key)
);
do $$ declare tab text; begin
 foreach tab in array array['team_movements','team_daily_activities','financial_outflows','team_request_keys'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
  execute format('create policy owner_read on public.%I for select to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role=''owner''))',tab);
 end loop;
end $$;
create function private.team_json(r jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text; begin
 foreach k in array array['cny_amount','actual_cny_handled','fee_rate','calculated_fee_idr','amount_idr','rate_or_fee'] loop
  if r ? k and r->k <> 'null'::jsonb then r=jsonb_set(r,array[k],to_jsonb(r->>k)); end if;
 end loop; return r;
end $$;
revoke all on function private.team_json(jsonb) from public,anon,authenticated;
create function public.mutate_team_activity(p_operation text,p_payload jsonb,p_key text,p_id uuid default null)
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
  select * into outflow from public.financial_outflows where source_type='team_daily_activity' and source_id=activity.id;
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
create function public.team_ledger(p_team uuid,p_date date,p_limit int default 20,p_offset int default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; movements jsonb; begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='owner') then raise insufficient_privilege; end if;
 if p_limit is null or p_offset is null or p_limit not between 1 and 100 or p_offset<0 or p_date is null or not isfinite(p_date) then raise sqlstate '22023'; end if;
 if not exists(select 1 from public.teams where id=p_team) then raise sqlstate 'P0001' using message='NOT_FOUND'; end if;
 select jsonb_build_object('balance_cny',coalesce(sum(case movement_type when 'distributed' then -cny_amount else cny_amount end),0)::text,
 'received_cny',coalesce(sum(cny_amount) filter(where movement_type='received' and business_date=p_date),0)::text,
 'distributed_cny',coalesce(sum(cny_amount) filter(where movement_type='distributed' and business_date=p_date),0)::text,
 'adjustment_cny',coalesce(sum(cny_amount) filter(where movement_type='adjustment' and business_date=p_date),0)::text)
 into result from public.team_movements where team_id=p_team and business_date<=p_date;
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('cny_amount',t.cny_amount::text)),'[]') into movements
 from (select * from public.team_movements where team_id=p_team and business_date=p_date order by created_at desc,id desc limit p_limit offset p_offset) t;
 return result||jsonb_build_object('movements',movements,'date',p_date,'limit',p_limit,'offset',p_offset);
end $$;
revoke all on function public.team_ledger(uuid,date,int,int) from public,anon;
grant execute on function public.team_ledger(uuid,date,int,int) to authenticated;
commit;
