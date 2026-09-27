begin;
-- Private helpers are invoked by database triggers/owner RPCs only.
revoke execute on all functions in schema private from public, anon, authenticated;
commit;
