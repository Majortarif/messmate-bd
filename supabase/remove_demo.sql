-- =============================================================================
-- MessMate BD · remove_demo.sql
-- Deletes every demo mess and demo account created by seed.sql (including their
-- ledger history). Real users and messes are not touched. Run in the Supabase
-- SQL editor before you invite real users, if you don't want the demo around.
-- =============================================================================

-- demo service directory entries (all use the fake 010 phone prefix)
delete from public.service_providers where phone like '0100000%';

select private.purge_data(
  array['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002']::uuid[],
  array(select id from auth.users where email like '%@messmate.demo')
);

select 'Demo data removed' as result,
       (select count(*) from auth.users where email like '%@messmate.demo') as demo_users_left;
