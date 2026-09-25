begin;
create table public.orders (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id) on delete restrict,
 business_date date not null,
 cny_amount numeric(18,2) not null check(cny_amount>0),
 customer_rate numeric(18,6) not null check(customer_rate>0),
 expected_idr numeric(20,2) not null check(expected_idr>=0),
 receiving_account_id uuid not null references public.accounts(id) on delete restrict,
 payment_status text not null default 'awaiting' check(payment_status in ('awaiting','received')),
 idr_received_at timestamptz,
 fulfillment_status text not null default 'pending' check(fulfillment_status in ('pending','sent')),
 cny_sent_at timestamptz, note text check(length(note)<=2000),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(expected_idr=round(cny_amount*customer_rate,2)),
 check((payment_status='received')=(idr_received_at is not null)),
 check((fulfillment_status='sent')=(cny_sent_at is not null))
);
create index orders_date on public.orders(business_date desc,created_at desc);
create index orders_customer on public.orders(customer_id);
create index orders_states on public.orders(payment_status,fulfillment_status);
create index orders_account on public.orders(receiving_account_id);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),
 actor_user_id uuid not null references public.profiles(id) on delete restrict,
 entity_type text not null, entity_id uuid not null, action text not null,
 before_json jsonb, after_json jsonb,
 created_at timestamptz not null default clock_timestamp()
);
create index audit_entity on public.audit_logs(entity_type,entity_id,created_at);
create table public.idempotency_keys (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 key text not null check(length(key) between 1 and 128), operation text not null,
 resource_id uuid references public.orders(id) on delete restrict,
 request_json jsonb not null, response_json jsonb not null,
 created_at timestamptz not null default clock_timestamp(), unique(user_id,key,operation)
);
do $$ declare tab text; begin
 foreach tab in array array['orders','audit_logs','idempotency_keys'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
  execute format('create policy owner_read on public.%I for select to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role=''owner''))',tab);
 end loop;
end $$;

-- Amounts in stored JSON are strings to preserve exact numeric values for audit/replays.
create function private.order_json(r public.orders) returns jsonb
language sql immutable set search_path='' as $$
 select to_jsonb(r)||jsonb_build_object('cny_amount',r.cny_amount::text,
 'customer_rate',r.customer_rate::text,'expected_idr',r.expected_idr::text)
$$;
revoke all on function private.order_json(public.orders) from public,anon,authenticated;

create function public.mutate_order(
 p_operation text, p_payload jsonb, p_id uuid default null,
 p_key text default null, p_version timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid=auth.uid(); old_row public.orders; new_row public.orders;
 old_json jsonb; result jsonb; request_value jsonb; cached public.idempotency_keys;
 scope text; material boolean; field text; allowed text[]; amount numeric; rate numeric;
begin
 if not exists(select 1 from public.profiles where id=actor and role='owner') then raise insufficient_privilege; end if;
 if p_operation is null or p_operation not in ('create','edit','receive','send') or
    p_payload is null or jsonb_typeof(p_payload)<>'object' then
  raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
 allowed=case p_operation when 'create' then array['customer_id','business_date','cny_amount','customer_rate','expected_idr','receiving_account_id','note']
 when 'edit' then array['customer_id','business_date','cny_amount','customer_rate','expected_idr','receiving_account_id','note']
 when 'receive' then array['received_at'] else array['sent_at'] end;
 if exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(allowed))) then
  raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
 if p_operation<>'create' and p_id is null then raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
 scope='orders:'||p_operation||coalesce(':'||p_id::text,'');
 request_value=p_payload;
 if p_operation<>'edit' then
  if p_key is null or length(p_key) not between 1 and 128 or p_key !~ '^[A-Za-z0-9_-]+$' then
   raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||scope||':'||p_key,0));
  select * into cached from public.idempotency_keys where user_id=actor and key=p_key and operation=scope;
  if found then
   if cached.request_json<>request_value then raise sqlstate 'P0001' using message='IDEMPOTENCY_CONFLICT'; end if;
   return cached.response_json;
  end if;
 end if;
 -- Same ordering as M2: acquire the assignment lock before any account/order rows.
 perform pg_advisory_xact_lock(20260923,1);
 if p_operation='create' then
  if not(p_payload ?& array['customer_id','business_date','cny_amount','customer_rate','receiving_account_id','expected_idr']) then
   raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  new_row.id=gen_random_uuid(); new_row.created_by=actor;
  new_row.created_at=clock_timestamp(); new_row.payment_status='awaiting'; new_row.fulfillment_status='pending';
 else
  select * into old_row from public.orders where id=p_id for update;
  if not found then raise sqlstate 'P0001' using message='NOT_FOUND'; end if;
  new_row=old_row; old_json=private.order_json(old_row);
  if p_operation='edit' and (p_version is null or p_version<>old_row.updated_at) then
   raise sqlstate 'P0001' using message='STALE_ORDER'; end if;
 end if;
 if p_operation in ('create','edit') then
  if p_payload='{}'::jsonb then raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  foreach field in array array['customer_id','business_date','cny_amount','customer_rate','receiving_account_id','expected_idr'] loop
   if p_payload ? field and (jsonb_typeof(p_payload->field)<>'string') then
    raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  end loop;
  if p_payload ? 'note' and jsonb_typeof(p_payload->'note') not in ('string','null') then
   raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  if p_payload ? 'customer_id' then new_row.customer_id=(p_payload->>'customer_id')::uuid; end if;
  if p_payload ? 'business_date' then new_row.business_date=(p_payload->>'business_date')::date; end if;
  if p_payload ? 'receiving_account_id' then new_row.receiving_account_id=(p_payload->>'receiving_account_id')::uuid; end if;
  if p_payload ? 'note' then new_row.note=p_payload->>'note'; end if;
  amount=coalesce((p_payload->>'cny_amount')::numeric,new_row.cny_amount);
  rate=coalesce((p_payload->>'customer_rate')::numeric,new_row.customer_rate);
  if amount is null or rate is null or amount<=0 or rate<=0 or amount>=1e16 or rate>=1e12 or
     amount<>round(amount,2) or rate<>round(rate,6) or amount::text in ('NaN','Infinity','-Infinity') or
     rate::text in ('NaN','Infinity','-Infinity') then raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  new_row.cny_amount=amount; new_row.customer_rate=rate;
  if round(amount*rate,2)>=1e18 then raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  new_row.expected_idr=round(amount*rate,2);
  if (p_payload ? 'expected_idr') and (p_payload->>'expected_idr')::numeric<>new_row.expected_idr then
   raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  material=p_operation='create' or
   row(new_row.customer_id,new_row.business_date,new_row.cny_amount,new_row.customer_rate,new_row.receiving_account_id)
   is distinct from row(old_row.customer_id,old_row.business_date,old_row.cny_amount,old_row.customer_rate,old_row.receiving_account_id);
  if p_operation='edit' and material and (old_row.payment_status<>'awaiting' or old_row.fulfillment_status<>'pending') then
   raise sqlstate 'P0001' using message='ORDER_LOCKED'; end if;
  if material then
   if not exists(select 1 from public.customers where id=new_row.customer_id) then
    raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
   if not exists(select 1 from public.accounts a join public.daily_account_assignments d on d.account_id=a.id
      where a.id=new_row.receiving_account_id and a.is_active and d.business_date=new_row.business_date) then
    raise sqlstate 'P0001' using message='ACCOUNT_NOT_ASSIGNED'; end if;
  end if;
 elsif p_operation='receive' then
  if coalesce(p_payload->>'received_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  if old_row.payment_status='received' and old_row.idr_received_at<>(p_payload->>'received_at')::timestamptz then
   raise sqlstate 'P0001' using message='STATE_CONFLICT'; end if;
  new_row.payment_status='received'; new_row.idr_received_at=(p_payload->>'received_at')::timestamptz;
 else
  if coalesce(p_payload->>'sent_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise sqlstate 'P0001' using message='INVALID_ORDER'; end if;
  if old_row.fulfillment_status='sent' and old_row.cny_sent_at<>(p_payload->>'sent_at')::timestamptz then
   raise sqlstate 'P0001' using message='STATE_CONFLICT'; end if;
  new_row.fulfillment_status='sent'; new_row.cny_sent_at=(p_payload->>'sent_at')::timestamptz;
 end if;
 if p_operation='create' or private.order_json(new_row) is distinct from old_json then
  new_row.updated_at=clock_timestamp();
  if p_operation='create' then insert into public.orders select (new_row).*;
  else update public.orders set customer_id=new_row.customer_id,business_date=new_row.business_date,
   cny_amount=new_row.cny_amount,customer_rate=new_row.customer_rate,expected_idr=new_row.expected_idr,
   receiving_account_id=new_row.receiving_account_id,note=new_row.note,payment_status=new_row.payment_status,
   idr_received_at=new_row.idr_received_at,fulfillment_status=new_row.fulfillment_status,
   cny_sent_at=new_row.cny_sent_at,updated_at=new_row.updated_at where id=new_row.id;
  end if;
  insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json)
  values(actor,'orders',new_row.id,p_operation,old_json,private.order_json(new_row));
 end if;
 result=private.order_json(new_row);
 if p_operation<>'edit' then
  insert into public.idempotency_keys(user_id,key,operation,resource_id,request_json,response_json)
  values(actor,p_key,scope,new_row.id,request_value,result);
 end if;
 return result;
end $$;
revoke all on function public.mutate_order(text,jsonb,uuid,text,timestamptz) from public,anon;
grant execute on function public.mutate_order(text,jsonb,uuid,text,timestamptz) to authenticated;
commit;
