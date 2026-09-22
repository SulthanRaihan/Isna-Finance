-- M1 only. Review and apply once to the development project as administrator.
begin;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete restrict,
    display_name text not null,
    role text not null check (role in ('owner', 'operator', 'developer')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- The application is exclusively for one owner. No automatic account promotion.
create unique index profiles_single_owner on public.profiles (role) where role = 'owner';
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;

create policy owner_reads_own_profile on public.profiles
    for select to authenticated
    using ((select auth.uid()) = id and role = 'owner');

-- No INSERT / UPDATE / DELETE grants or policies for application users.
-- A trusted administrator provisions the profile separately.
comment on table public.profiles is 'M1 owner-only identity. Admin-managed; no client role changes.';
commit;
