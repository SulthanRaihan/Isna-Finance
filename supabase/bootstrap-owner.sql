-- Run manually as administrator AFTER the migration and Auth user creation.
-- Replace the UUID below locally. Never commit a real account UUID or password.
-- This script refuses to overwrite profiles or promote the first arbitrary user.
begin;
do $$
declare
    owner_id uuid := '00000000-0000-0000-0000-000000000000';
begin
    if owner_id = '00000000-0000-0000-0000-000000000000'::uuid then
        raise exception 'Replace owner_id with the intended Isna Auth user UUID first';
    end if;
    if not exists (select 1 from auth.users where id = owner_id) then
        raise exception 'The intended Auth user does not exist';
    end if;
    insert into public.profiles (id, display_name, role)
    values (owner_id, 'Isna', 'owner');
end $$;
commit;
