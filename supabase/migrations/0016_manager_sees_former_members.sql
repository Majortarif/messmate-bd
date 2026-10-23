-- =============================================================================
-- MessMate BD · 0016 · Managers can see former members' names
-- A manager still settles money with people who left (refund payouts, old
-- ledger lines), so they need the name / phone of anyone who ever belonged to
-- the mess they manage. Everyone else keeps the original visibility.
-- =============================================================================

create or replace function private.can_view_profile(p_user uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_user = auth.uid()
      or exists (
           select 1 from public.mess_members mm
           where mm.user_id = p_user
             and mm.mess_id = private.current_mess_id()
             and mm.status in ('active', 'inactive'))
      or exists (
           select 1 from public.mess_members mm
           where mm.user_id = p_user
             and mm.mess_id = private.managed_mess_id())
      or private.is_super_admin()
$$;
