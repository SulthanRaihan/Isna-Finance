begin;
create table public.business_balance_openings (
 id uuid primary key default gen_random_uuid(),
 effective_date date not null unique check(isfinite(effective_date)),
 opening_amount_idr numeric(20,2) not null check(opening_amount_idr::text not in ('NaN','Infinity','-Infinity')),
 note text check(length(note)<=2000),
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.business_balance_openings enable row level security;
alter table public.business_balance_openings force row level security;
revoke all on public.business_balance_openings from public,anon,authenticated;
grant select on public.business_balance_openings to authenticated;
create policy owner_read on public.business_balance_openings for select to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='owner'));
create index orders_received_reporting on public.orders(idr_received_at) where payment_status='received';

-- STABLE gives all statements the calling query's snapshot. Reporting never writes.
create function public.daily_report(p_date date,p_section text default 'orders',p_limit int default 20,p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare zone text; day_start timestamptz; day_end timestamptz; opening_start timestamptz;
 opening public.business_balance_openings; position_amount numeric; position_json jsonb;
 customer_n bigint; order_n bigint; volume numeric; completed_n bigint;
 money_in numeric; money_out numeric; awaiting_n bigint; ready_n bigint; sent_n bigint;
 nonzero_n bigint; breakdown jsonb; warnings jsonb='[]'; accounts jsonb;
 items jsonb; total bigint; summary jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='owner') then raise insufficient_privilege; end if;
 if p_date is null or not isfinite(p_date) or p_section is null or p_section not in ('orders','money_in','outflows','pending','teams')
 or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then raise sqlstate '22023'; end if;
 select timezone into zone from private.business_settings where singleton;
 day_start=p_date::timestamp at time zone zone;
 day_end=(p_date+1)::timestamp at time zone zone;
 select count(distinct customer_id),count(*),coalesce(sum(cny_amount),0),
 count(*) filter(where payment_status='received' and fulfillment_status='sent')
 into customer_n,order_n,volume,completed_n from public.orders where business_date=p_date;
 select coalesce(sum(expected_idr),0) into money_in from public.orders
 where payment_status='received' and idr_received_at>=day_start and idr_received_at<day_end;
 select coalesce(sum(amount_idr),0) into money_out from public.financial_outflows
 where business_date=p_date and status='posted';
 select count(*) filter(where payment_status='awaiting'),
 count(*) filter(where payment_status='received' and fulfillment_status='pending'),
 count(*) filter(where payment_status='awaiting' and fulfillment_status='sent')
 into awaiting_n,ready_n,sent_n from public.orders where business_date<=p_date;
 select jsonb_agg(jsonb_build_object('category',c.category,'amount_idr',coalesce(f.amount,0)::text) order by c.ordinality)
 into breakdown from unnest(array['rmb_purchase','team_fee','atm_card_fee','exchange_fee','other']) with ordinality c(category,ordinality)
 left join (select category,sum(amount_idr) amount from public.financial_outflows where business_date=p_date and status='posted' group by category) f on f.category=c.category;
 select count(*) into nonzero_n from (
 select team_id from public.team_movements where business_date<=p_date group by team_id
 having sum(case movement_type when 'distributed' then -cny_amount else cny_amount end)<>0
 ) balances;
 if sent_n>0 then warnings=warnings||jsonb_build_array(jsonb_build_object('code','sent_awaiting_payment','severity','info','count',sent_n,'section','pending')); end if;
 if nonzero_n>0 then warnings=warnings||jsonb_build_array(jsonb_build_object('code','nonzero_team_balance','severity','info','count',nonzero_n,'section','teams')); end if;
 select * into opening from public.business_balance_openings where effective_date<=p_date order by effective_date desc limit 1;
 if found then
  opening_start=opening.effective_date::timestamp at time zone zone;
  select opening.opening_amount_idr
   + coalesce((select sum(expected_idr) from public.orders where payment_status='received' and idr_received_at>=opening_start and idr_received_at<day_end),0)
   - coalesce((select sum(amount_idr) from public.financial_outflows where status='posted' and business_date between opening.effective_date and p_date),0)
   into position_amount;
  position_json=jsonb_build_object('status','configured','amount_idr',position_amount::text,
   'opening',jsonb_build_object('id',opening.id,'effective_date',opening.effective_date,'opening_amount_idr',opening.opening_amount_idr::text));
 else position_json=jsonb_build_object('status','not_configured','amount_idr',null,'opening',null); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'label',a.label,'bank_name',a.bank_name,'account_last4',a.account_last4,'is_active',a.is_active,'is_default',d.is_default) order by d.is_default desc,a.label,a.id),'[]')
 into accounts from public.daily_account_assignments d join public.accounts a on a.id=d.account_id where d.business_date=p_date;
 summary=jsonb_build_object('date',p_date,'timezone',zone,'customer_count',customer_n,'order_count',order_n,'total_cny',volume::text,
 'money_in_idr',money_in::text,'money_out_idr',money_out::text,'profit_idr',(money_in-money_out)::text,
 'recorded_business_balance_idr',position_amount::text,'business_position',position_json,
 'orders',jsonb_build_object('awaiting_payment',awaiting_n,'ready_to_send',ready_n,'sent_awaiting_payment',sent_n,'completed',completed_n),
 'pending_count',awaiting_n+ready_n,'category_breakdown',breakdown,'warnings',warnings,'receiving_accounts',accounts);
 if p_section in ('orders','money_in','pending') then
  select count(*) into total from public.orders o where
   case p_section when 'orders' then o.business_date=p_date
    when 'money_in' then o.payment_status='received' and o.idr_received_at>=day_start and o.idr_received_at<day_end
    else o.business_date<=p_date and (o.payment_status='awaiting' or o.fulfillment_status='pending') end;
  select coalesce(jsonb_agg(t.row order by t.business_date desc,t.created_at desc,t.id desc),'[]') into items from (
   select o.id,o.business_date,o.created_at,
    private.order_json(o)||jsonb_build_object('customer_name',c.display_name,
     'account_label',a.label,'account_last4',a.account_last4,
     'money_in_date',case when o.payment_status='received' then (o.idr_received_at at time zone zone)::date else null end) as row
   from public.orders o join public.customers c on c.id=o.customer_id join public.accounts a on a.id=o.receiving_account_id
   where case p_section when 'orders' then o.business_date=p_date
    when 'money_in' then o.payment_status='received' and o.idr_received_at>=day_start and o.idr_received_at<day_end
    else o.business_date<=p_date and (o.payment_status='awaiting' or o.fulfillment_status='pending') end
   order by o.business_date desc,o.created_at desc,o.id desc limit p_limit offset p_offset
  ) t;
 elsif p_section='outflows' then
  select count(*) into total from public.financial_outflows where business_date=p_date and status='posted';
  select coalesce(jsonb_agg(private.team_json(to_jsonb(f)) order by f.created_at desc,f.id desc),'[]') into items from (
   select * from public.financial_outflows where business_date=p_date and status='posted' order by created_at desc,id desc limit p_limit offset p_offset
  ) f;
 else
  select count(*) into total from public.teams;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.name,t.id),'[]') into items from (
   select t.id,t.name,t.is_active,coalesce(sum(case m.movement_type when 'distributed' then -m.cny_amount else m.cny_amount end),0)::text as balance_cny
   from public.teams t left join public.team_movements m on m.team_id=t.id and m.business_date<=p_date
   group by t.id order by t.name,t.id limit p_limit offset p_offset
  ) t;
 end if;
 return summary||jsonb_build_object('page',jsonb_build_object('section',p_section,'items',items,'total',total,'limit',p_limit,'offset',p_offset));
end $$;
revoke all on function public.daily_report(date,text,int,int) from public,anon;
grant execute on function public.daily_report(date,text,int,int) to authenticated;
commit;
