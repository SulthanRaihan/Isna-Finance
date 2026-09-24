begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.business_settings (
  singleton boolean primary key default true check (singleton),
  timezone text not null
);
insert into private.business_settings values (true, 'Asia/Jakarta');

create function public.business_context() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare zone text;
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='owner') then
    raise insufficient_privilege;
  end if;
  select timezone into zone from private.business_settings where singleton;
  return jsonb_build_object('timezone',zone,'business_date',(statement_timestamp() at time zone zone)::date);
end $$;
revoke all on function public.business_context() from public, anon;
grant execute on function public.business_context() to authenticated;

create table public.customers (
 id uuid primary key default gen_random_uuid(),
 display_name text not null check(length(btrim(display_name)) between 1 and 120),
 note text check(length(note)<=2000), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index customers_name_search on public.customers(lower(display_name));
create index customers_active on public.customers(is_active);
create table public.accounts (
 id uuid primary key default gen_random_uuid(),
 label text not null check(length(btrim(label)) between 1 and 120),
 bank_name text not null check(length(btrim(bank_name)) between 1 and 120),
 country_code text not null check(country_code ~ '^[A-Z]{2}$'),
 account_last4 text check(account_last4 ~ '^[0-9]{4}$'),
 account_type text check(length(account_type) between 1 and 40),
 is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.teams (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(length(btrim(name)) between 1 and 120),
 default_fee_rate numeric(18,6) not null default 2 check(default_fee_rate>=0),
 is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.daily_account_assignments (
 id uuid primary key default gen_random_uuid(),
 business_date date not null,
 account_id uuid not null references public.accounts(id) on delete restrict,
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 unique(business_date,account_id)
);
create unique index daily_account_default on public.daily_account_assignments(business_date) where is_default;
create index daily_account_references on public.daily_account_assignments(account_id,business_date);

do $$ declare tab text; begin
 foreach tab in array array['customers','accounts','teams','daily_account_assignments'] loop
   execute format('alter table public.%I enable row level security',tab);
   execute format('alter table public.%I force row level security',tab);
   execute format('revoke all on public.%I from public,anon,authenticated',tab);
   execute format('grant select,insert,update on public.%I to authenticated',tab);
   execute format('create policy owner_access on public.%I for all to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role=''owner'')) with check (exists(select 1 from public.profiles where id=(select auth.uid()) and role=''owner''))',tab);
 end loop;
end $$;
-- Assignment removal is available only through the checked replacement RPC.
revoke insert,update on public.daily_account_assignments from authenticated;

create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create trigger customers_updated before update on public.customers for each row execute function private.touch_updated_at();
create trigger accounts_updated before update on public.accounts for each row execute function private.touch_updated_at();
create trigger teams_updated before update on public.teams for each row execute function private.touch_updated_at();

-- All account updates acquire the same transaction lock before taking row locks.
create function private.lock_account_choices() returns trigger language plpgsql set search_path='' as $$
begin perform pg_advisory_xact_lock(20260923,1); return null; end $$;
create trigger accounts_choices_lock before update on public.accounts for each statement execute function private.lock_account_choices();

create function private.prevent_assigned_deactivation() returns trigger
language plpgsql security definer set search_path='' as $$
declare today date; conflicts jsonb; zone text;
begin
 if old.is_active and not new.is_active then
   select timezone into zone from private.business_settings where singleton;
   today=(statement_timestamp() at time zone zone)::date;
   select jsonb_agg(jsonb_build_object('business_date',business_date,'account_id',account_id,'is_default',is_default) order by business_date)
     into conflicts from public.daily_account_assignments where account_id=old.id and business_date>=today;
   if conflicts is not null then
     raise sqlstate 'P0001' using message='ACCOUNT_ASSIGNED', detail=conflicts::text;
   end if;
 end if;
 return new;
end $$;
create trigger accounts_deactivation before update on public.accounts for each row execute function private.prevent_assigned_deactivation();

create function public.replace_daily_accounts(p_date date,p_account_ids uuid[],p_default uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='owner') then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(20260923,1);
 if p_date is null or p_account_ids is null or array_position(p_account_ids,null) is not null then
   raise sqlstate '22023' using message='Invalid daily choices'; end if;
 if p_default is not null and not(p_default=any(p_account_ids)) then
   raise sqlstate '22023' using message='Default must be selected'; end if;
 if cardinality(p_account_ids)<>(select count(distinct x) from unnest(p_account_ids) x) then
   raise sqlstate '22023' using message='Duplicate account'; end if;
 if exists(select 1 from unnest(p_account_ids) x left join public.accounts a on a.id=x where a.id is null or not a.is_active) then
   raise sqlstate '22023' using message='Account must exist and be active'; end if;
 delete from public.daily_account_assignments where business_date=p_date;
 insert into public.daily_account_assignments(business_date,account_id,is_default)
 select p_date,x,coalesce(x=p_default,false) from unnest(p_account_ids) x;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.account_id),'[]'::jsonb) into result from public.daily_account_assignments d where business_date=p_date;
 return result;
end $$;
revoke all on function public.replace_daily_accounts(date,uuid[],uuid) from public,anon;
grant execute on function public.replace_daily_accounts(date,uuid[],uuid) to authenticated;
commit;
