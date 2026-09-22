-- Run as administrator on a disposable DEVELOPMENT project after the migration,
-- before owner bootstrap. Uses synthetic identities and rolls everything back.
begin;
do $$ begin
  if exists (select 1 from public.profiles) then
    raise exception 'Run this test only on an empty development profiles table';
  end if;
end $$;
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'owner@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'other@example.test');
insert into public.profiles (id, display_name, role) values
  ('10000000-0000-4000-8000-000000000001', 'Synthetic Owner', 'owner'),
  ('10000000-0000-4000-8000-000000000002', 'Synthetic Developer', 'developer');

set local role anon;
do $$ begin
  begin
    perform * from public.profiles;
    raise exception 'FAIL: anonymous profile access was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$ begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL: owner must read exactly their own profile';
  end if;
  begin
    update public.profiles set role='developer';
    raise exception 'FAIL: client profile writes were allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$ begin
  if (select count(*) from public.profiles) <> 0 then
    raise exception 'FAIL: developer must not have owner access';
  end if;
  begin
    insert into public.profiles(id, display_name, role)
    values ('10000000-0000-4000-8000-000000000003','Unauthorized','owner');
    raise exception 'FAIL: client owner promotion was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
