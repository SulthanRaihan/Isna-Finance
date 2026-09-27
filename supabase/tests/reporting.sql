-- Empty disposable database only. Synthetic fixtures roll back.
begin;
do $$ begin if exists(select 1 from public.profiles) then raise exception 'Use empty database'; end if; end $$;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','owner@example.test'),('10000000-0000-4000-8000-000000000002','developer@example.test');
insert into public.profiles(id,display_name,role) values('10000000-0000-4000-8000-000000000001','Synthetic','owner'),('10000000-0000-4000-8000-000000000002','Synthetic developer','developer');
insert into public.customers(id,display_name) values('20000000-0000-4000-8000-000000000001','Synthetic customer');
insert into public.accounts(id,label,bank_name,country_code) values('30000000-0000-4000-8000-000000000001','Synthetic','Test','ID');
insert into public.teams(id,name) values('40000000-0000-4000-8000-000000000001','Synthetic team');
insert into public.orders(customer_id,business_date,cny_amount,customer_rate,expected_idr,receiving_account_id,payment_status,idr_received_at,fulfillment_status,cny_sent_at,created_by)
select '20000000-0000-4000-8000-000000000001',d,1,100,100,'30000000-0000-4000-8000-000000000001',p,r,f,s,'10000000-0000-4000-8000-000000000001' from (values
 ('2020-01-02'::date,'received','2020-01-01T17:00:00Z'::timestamptz,'pending',null::timestamptz),
 ('2020-01-02','received','2020-01-01T16:59:59Z','sent','2020-01-02T01:00:00Z'),
 ('2019-12-31','awaiting',null,'sent','2020-01-01T01:00:00Z'),
 ('2020-01-03','awaiting',null,'pending',null),
 ('2020-01-03','received','2020-01-02T17:00:00Z','sent','2020-01-03T02:00:00Z'),
 ('2019-12-30','received','2020-01-02T02:00:00Z','sent','2020-01-03T01:00:00Z')
) v(d,p,r,f,s);
insert into public.financial_outflows(business_date,category,description,amount_idr,status,created_by) values
 ('2020-01-02','exchange_fee','Synthetic',19.25,'posted','10000000-0000-4000-8000-000000000001'),
 ('2020-01-02','other','Synthetic void',999,'voided','10000000-0000-4000-8000-000000000001'),
 ('2020-01-03','other','Synthetic future',50,'posted','10000000-0000-4000-8000-000000000001');
insert into public.team_movements(team_id,business_date,movement_type,cny_amount,created_by) values
 ('40000000-0000-4000-8000-000000000001','2020-01-01','received',100,'10000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000001','2020-01-02','distributed',30,'10000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000001','2020-01-02','adjustment',-2.5,'10000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000001','2020-01-03','received',500,'10000000-0000-4000-8000-000000000001');
insert into public.atm_card_activities(business_date,actual_cny_handled,fee_rate,calculated_fee_idr,created_by)
 values('2020-01-02',5600,1.7,9520,'10000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 r=public.daily_report('2020-01-02','orders',1,0);
 if r->>'customer_count'<>'1' or r->>'order_count'<>'2' or (r->>'total_cny')::numeric<>2 then raise exception 'Counts/volume wrong'; end if;
 if (r->>'money_in_idr')::numeric<>200 or (r->>'money_out_idr')::numeric<>19.25 or (r->>'profit_idr')::numeric<>180.75 then raise exception 'Recognition/rounding wrong'; end if;
 if r->'business_position'->>'status'<>'not_configured' or r->'recorded_business_balance_idr'<>'null'::jsonb then raise exception 'Missing opening fabricated'; end if;
 if r->>'pending_count'<>'2' or r->'orders'->>'sent_awaiting_payment'<>'1' then raise exception 'Pending cutoff/current state wrong'; end if;
 if jsonb_array_length(r->'page'->'items')<>1 or r->'page'->>'total'<>'2' then raise exception 'Pagination changed totals'; end if;
 r=public.daily_report('2020-01-02','teams',20,0);
 if (r->'page'->'items'->0->>'balance_cny')::numeric<>67.5 or jsonb_array_length(r->'warnings')<>2 then raise exception 'Team balance/warnings wrong'; end if;
 if r->'warnings'->0->>'severity'<>'info' then raise exception 'Warnings misclassified'; end if;
 r=public.daily_report('2020-01-02','money_in',20,0);
 if r->'page'->>'total'<>'2' then raise exception 'Money In rows wrong'; end if;
 r=public.daily_report('2020-01-02','outflows',20,0);
 if r->'page'->>'total'<>'1' then raise exception 'Voided/future posting included'; end if;
end $$;
savepoint correction_report;
do $$ declare f public.financial_outflows; r jsonb; begin
 select * into f from public.financial_outflows where category='exchange_fee';
 perform public.mutate_money_out('correct',jsonb_build_object('reason','Synthetic report test','updated_at',f.updated_at::text,'business_date','2020-01-02','description','Synthetic corrected fee','amount_idr','20.25'),'report-correction',f.id);
 r=public.daily_report('2020-01-02','outflows');
 if (r->>'money_out_idr')::numeric<>20.25 or r->'page'->>'total'<>'1' then raise exception 'Correction double counted'; end if;
end $$;
rollback to correction_report;
reset role;
insert into public.business_balance_openings(effective_date,opening_amount_idr,created_by) values
 ('2019-12-01',1000,'10000000-0000-4000-8000-000000000001'),
 ('2020-01-02',500,'10000000-0000-4000-8000-000000000001'),
 ('2020-02-01',9999,'10000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$ declare r jsonb; begin
 r=public.daily_report('2020-01-02');
 if r->'business_position'->>'status'<>'configured' or (r->>'recorded_business_balance_idr')::numeric<>680.75 then raise exception 'Inclusive latest opening failed'; end if;
 r=public.daily_report('2019-01-01');
 if r->'business_position'->>'status'<>'not_configured' or (r->>'money_in_idr')::numeric<>0 then raise exception 'Empty date failed'; end if;
 begin insert into public.business_balance_openings(effective_date,opening_amount_idr,created_by) values('2020-03-01',0,auth.uid()); raise exception 'Direct write allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.business_balance_openings) then raise exception 'Developer read'; end if;
 begin perform public.daily_report('2020-01-02'); raise exception 'Developer report allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.daily_report('2020-01-02'); raise exception 'Anonymous report allowed' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
