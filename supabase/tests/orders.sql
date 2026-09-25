-- EMPTY disposable database only. Synthetic test records always roll back.
begin;
do $$ begin if exists(select 1 from public.profiles) then raise exception 'Use empty database'; end if; end $$;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','owner@example.test'),
 ('10000000-0000-4000-8000-000000000002','developer@example.test');
insert into public.profiles(id,display_name,role) values
 ('10000000-0000-4000-8000-000000000001','Synthetic Owner','owner'),
 ('10000000-0000-4000-8000-000000000002','Synthetic Developer','developer');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.customers(id,display_name) values('20000000-0000-4000-8000-000000000001','Synthetic Customer');
insert into public.accounts(id,label,bank_name,country_code) values
 ('30000000-0000-4000-8000-000000000001','Synthetic A','Demo','ID'),
 ('30000000-0000-4000-8000-000000000002','Synthetic B','Demo','ID');
select public.replace_daily_accounts('2020-01-01',array['30000000-0000-4000-8000-000000000001'::uuid], '30000000-0000-4000-8000-000000000001');
do $$ declare payload jsonb; result jsonb; again jsonb; oid uuid; version timestamptz; change jsonb; audit_count int; bad jsonb; second jsonb; begin
 payload='{"customer_id":"20000000-0000-4000-8000-000000000001","business_date":"2020-01-01","cny_amount":"1.00","customer_rate":"100.005000","expected_idr":"100.01","receiving_account_id":"30000000-0000-4000-8000-000000000001","note":null}';
 result=public.mutate_order('create',payload,null,'synthetic-create'); oid=(result->>'id')::uuid;
 if result->>'expected_idr'<>'100.01' then raise exception 'Rounding failed'; end if;
 again=public.mutate_order('create',payload,null,'synthetic-create');
 if again<>result or (select count(*) from public.orders)<>1 or (select count(*) from public.audit_logs)<>1 then raise exception 'Duplicate order or audit'; end if;
 begin
  perform public.mutate_order('create',payload||'{"note":"different"}',null,'synthetic-create');
  raise exception 'Expected idempotency conflict' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end;
 foreach bad in array array[
  '{"receiving_account_id":"30000000-0000-4000-8000-000000000002"}'::jsonb,
  '{"business_date":"2020-01-02"}'::jsonb,
  '{"expected_idr":"100.00"}'::jsonb,
  '{"cny_amount":"1.001"}'::jsonb,
  '{"cny_amount":1}'::jsonb,
  '{"cny_amount":"9999999999999999.99","customer_rate":"999999999999.999999"}'::jsonb
 ] loop
  begin
   perform public.mutate_order('create',payload||bad,null,'invalid');
   raise exception 'Invalid order accepted' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
 end loop;
 if (select count(*) from public.idempotency_keys)<>1 or (select count(*) from public.audit_logs)<>1 then raise exception 'Rejected requests persisted'; end if;
 version=(result->>'updated_at')::timestamptz;
 result=public.mutate_order('edit','{"cny_amount":"2.00","expected_idr":"200.01"}',oid,null,version);
 if result->>'expected_idr'<>'200.01' then raise exception 'Edit calculation failed'; end if;
 begin
  perform public.mutate_order('edit','{"note":"stale"}',oid,null,version);
  raise exception 'Stale write accepted' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'STALE_ORDER' then raise; end if; end;
 result=public.mutate_order('send','{"sent_at":"2020-01-01T10:00:00+07:00"}',oid,'send-key');
 if result->>'payment_status'<>'awaiting' or result->>'fulfillment_status'<>'sent' then raise exception 'States coupled'; end if;
 foreach change in array array[
 '{"customer_id":"20000000-0000-4000-8000-000000000002"}'::jsonb,
 '{"business_date":"2020-01-02"}'::jsonb,
 '{"cny_amount":"3.00","expected_idr":"300.02"}'::jsonb,
 '{"customer_rate":"101.00","expected_idr":"202.00"}'::jsonb,
 '{"receiving_account_id":"30000000-0000-4000-8000-000000000002"}'::jsonb
 ] loop
  begin
   perform public.mutate_order('edit',change,oid,null,(result->>'updated_at')::timestamptz);
   raise exception 'Locked field changed' using errcode='ZX001';
  exception when sqlstate 'P0001' then if sqlerrm<>'ORDER_LOCKED' then raise; end if; end;
 end loop;
 result=public.mutate_order('receive','{"received_at":"2020-01-01T18:00:00+00:00"}',oid,'receive-key');
 if (select (idr_received_at at time zone 'Asia/Jakarta')::date from public.orders where id=oid)<>'2020-01-02' then raise exception 'Received date lost'; end if;
 select count(*) into audit_count from public.audit_logs;
 perform public.mutate_order('receive','{"received_at":"2020-01-01T18:00:00+00:00"}',oid,'receive-key');
 perform public.mutate_order('receive','{"received_at":"2020-01-01T18:00:00+00:00"}',oid,'receive-new-key');
 if (select count(*) from public.audit_logs)<>audit_count then raise exception 'Duplicate transition audit'; end if;
 begin
  perform public.mutate_order('receive','{"received_at":"2020-01-02T18:00:00+00:00"}',oid,'receive-change');
  raise exception 'Realized timestamp changed' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'STATE_CONFLICT' then raise; end if; end;

 second=public.mutate_order('create',payload,null,'received-only-create');
 second=public.mutate_order('receive','{"received_at":"2020-01-01T10:00:00+07:00"}',(second->>'id')::uuid,'received-only');
 if second->>'fulfillment_status'<>'pending' then raise exception 'Receive changed fulfillment'; end if;
 begin
  perform public.mutate_order('edit','{"cny_amount":"2.00","expected_idr":"200.01"}',(second->>'id')::uuid,null,(second->>'updated_at')::timestamptz);
  raise exception 'Received-only amount edit allowed' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORDER_LOCKED' then raise; end if; end;
 update public.accounts set is_active=false where id='30000000-0000-4000-8000-000000000001';
 result=public.mutate_order('edit','{"note":"Synthetic note after realization"}',oid,null,(result->>'updated_at')::timestamptz);
 if result->>'note'<>'Synthetic note after realization' or result->>'expected_idr'<>'200.01' then raise exception 'Note edit changed money'; end if;
 begin
  perform public.mutate_order('create',payload,null,'inactive');
  raise exception 'Inactive account used' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'ACCOUNT_NOT_ASSIGNED' then raise; end if; end;
 if (select count(*) from public.daily_account_assignments)<>1 then raise exception 'Order mutated assignments'; end if;
 begin update public.orders set note='bypass'; raise exception 'Direct write allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin delete from public.orders; raise exception 'Delete allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin update public.audit_logs set action='fake'; raise exception 'Audit mutable' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.orders) or exists(select 1 from public.audit_logs) or exists(select 1 from public.idempotency_keys) then raise exception 'Developer can read'; end if;
 begin perform public.mutate_order('create','{}',null,'denied'); raise exception 'Developer can write' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.orders; raise exception 'Anon can read' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform public.mutate_order('create','{}',null,'denied'); raise exception 'Anon can write' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
