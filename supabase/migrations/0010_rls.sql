-- =============================================================================
-- MessMate BD · 0010 · Row Level Security + grants
--
-- Shorthands used in every policy (wrapped in SELECT so Postgres evaluates them
-- once per query, not once per row):
--   me       = (select auth.uid())
--   my mess  = (select private.current_mess_id())   active / inactive member
--   managed  = (select private.managed_mess_id())   active manager
--   admin    = (select private.is_super_admin())
--
-- Writes to money, membership, orders, polls and care alerts go through
-- SECURITY DEFINER RPCs only — those tables have no INSERT/UPDATE policies.
-- =============================================================================

-- RLS on for every table in public (and any table added later must do the same;
-- tests/rls_isolation.sql fails if one is missing).
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------- core ------
create policy "areas: anyone can read" on public.areas
  for select to anon, authenticated using (true);
create policy "areas: super admin writes" on public.areas
  for all to authenticated using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy "profiles: self, messmates, applicants, admin" on public.profiles
  for select to authenticated using (private.can_view_profile(id));
create policy "profiles: insert self" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: super admin updates" on public.profiles
  for update to authenticated using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy "messes: members and admin read" on public.messes
  for select to authenticated
  using (id = (select private.current_mess_id()) or (select private.is_super_admin()));
create policy "messes: manager updates" on public.messes
  for update to authenticated
  using (id = (select private.managed_mess_id()) or (select private.is_super_admin()))
  with check (id = (select private.managed_mess_id()) or (select private.is_super_admin()));
create policy "messes: super admin deletes" on public.messes
  for delete to authenticated using ((select private.is_super_admin()));

create policy "mess_settings: members read" on public.mess_settings
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "mess_settings: manager updates" on public.mess_settings
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())) with check (mess_id = (select private.managed_mess_id()));

create policy "mess_rooms: members read" on public.mess_rooms
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "mess_rooms: manager inserts" on public.mess_rooms
  for insert to authenticated with check (mess_id = (select private.managed_mess_id()));
create policy "mess_rooms: manager updates" on public.mess_rooms
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())) with check (mess_id = (select private.managed_mess_id()));
create policy "mess_rooms: manager deletes" on public.mess_rooms
  for delete to authenticated using (mess_id = (select private.managed_mess_id()));

create policy "mess_members: own rows, messmates, manager, admin" on public.mess_members
  for select to authenticated
  using (user_id = (select auth.uid())
         or (mess_id = (select private.current_mess_id()) and status in ('active', 'inactive'))
         or mess_id = (select private.managed_mess_id())
         or (select private.is_super_admin()));

create policy "notifications: own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: delete own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "audit_logs: manager of mess, admin" on public.audit_logs
  for select to authenticated
  using (mess_id = (select private.managed_mess_id()) or (select private.is_super_admin()));

create policy "legal_acceptances: own" on public.legal_acceptances
  for select to authenticated using (user_id = (select auth.uid()));

create policy "feedback: own and admin read" on public.feedback
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "feedback: admin updates" on public.feedback
  for update to authenticated using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

-- ---------------------------------------------------------------- money ------
create policy "monthly_closings: members read" on public.monthly_closings
  for select to authenticated using (mess_id = (select private.current_mess_id()));

create policy "ledger_entries: own or manager" on public.ledger_entries
  for select to authenticated
  using (user_id = (select auth.uid()) or mess_id = (select private.managed_mess_id()));

create policy "deposit_requests: own or manager" on public.deposit_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or mess_id = (select private.managed_mess_id()));

create policy "expenses: members read" on public.expenses
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "expenses: manager inserts" on public.expenses
  for insert to authenticated with check (mess_id = (select private.managed_mess_id()));
create policy "expenses: manager updates" on public.expenses
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())) with check (mess_id = (select private.managed_mess_id()));
create policy "expenses: manager deletes" on public.expenses
  for delete to authenticated using (mess_id = (select private.managed_mess_id()));

create policy "bills: members read" on public.bills
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "bills: manager inserts" on public.bills
  for insert to authenticated with check (mess_id = (select private.managed_mess_id()));
create policy "bills: manager updates drafts" on public.bills
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())) with check (mess_id = (select private.managed_mess_id()));
create policy "bills: manager deletes drafts" on public.bills
  for delete to authenticated using (mess_id = (select private.managed_mess_id()));

create policy "bill_shares: own or manager" on public.bill_shares
  for select to authenticated
  using (user_id = (select auth.uid()) or mess_id = (select private.managed_mess_id()));

create policy "member_statements: own or manager" on public.member_statements
  for select to authenticated
  using (user_id = (select auth.uid()) or mess_id = (select private.managed_mess_id()));

-- ---------------------------------------------------------------- meals ------
create policy "menus: members read" on public.menus
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "menus: manager inserts" on public.menus
  for insert to authenticated with check (mess_id = (select private.managed_mess_id()));
create policy "menus: manager updates" on public.menus
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())) with check (mess_id = (select private.managed_mess_id()));
create policy "menus: manager deletes" on public.menus
  for delete to authenticated using (mess_id = (select private.managed_mess_id()));

create policy "meal_orders: own or manager" on public.meal_orders
  for select to authenticated
  using (user_id = (select auth.uid()) or mess_id = (select private.managed_mess_id()));

-- -------------------------------------------------------------- housing ------
create policy "listings: approved, own, admin" on public.listings
  for select to authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "listings: create own" on public.listings
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "listings: owner or admin updates" on public.listings
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_super_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "listings: owner or admin deletes" on public.listings
  for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "listing_photos: visible with listing" on public.listing_photos
  for select to authenticated using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "listing_photos: owner adds" on public.listing_photos
  for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())));
create policy "listing_photos: owner or admin removes" on public.listing_photos
  for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
         or (select private.is_super_admin()));

create policy "saved_listings: own" on public.saved_listings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "roommate_profiles: own" on public.roommate_profiles
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "roommate_area_prefs: own" on public.roommate_area_prefs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "rent_records: own" on public.rent_records
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "rent_payments: own" on public.rent_payments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (exists (select 1 from public.rent_records r where r.id = rent_record_id and r.user_id = (select auth.uid())));

create policy "move_checklists: own" on public.move_checklists
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "move_checklist_items: own" on public.move_checklist_items
  for all to authenticated
  using (exists (select 1 from public.move_checklists c where c.id = checklist_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.move_checklists c where c.id = checklist_id and c.user_id = (select auth.uid())));

-- ------------------------------------------------------------ community ------
create policy "complaints: members read" on public.complaints
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "complaints: members file" on public.complaints
  for insert to authenticated
  with check (mess_id = (select private.current_mess_id()) and created_by = (select auth.uid()));
create policy "complaints: author or manager updates" on public.complaints
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())
         or (created_by = (select auth.uid()) and mess_id = (select private.current_mess_id())))
  with check (mess_id = (select private.current_mess_id()));
create policy "complaints: manager or author (open) deletes" on public.complaints
  for delete to authenticated
  using (mess_id = (select private.managed_mess_id())
         or (created_by = (select auth.uid()) and status = 'open' and mess_id = (select private.current_mess_id())));

create policy "complaint_updates: visible with complaint" on public.complaint_updates
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "complaint_updates: members reply" on public.complaint_updates
  for insert to authenticated
  with check (author_id = (select auth.uid())
              and exists (select 1 from public.complaints c
                          where c.id = complaint_id and c.mess_id = (select private.current_mess_id())));

create policy "chores: members read" on public.chores
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "chores: manager inserts" on public.chores
  for insert to authenticated with check (mess_id = (select private.managed_mess_id()));
create policy "chores: manager or assignee updates" on public.chores
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())
         or (assigned_to = (select auth.uid()) and mess_id = (select private.current_mess_id())))
  with check (mess_id = (select private.current_mess_id()));
create policy "chores: manager deletes" on public.chores
  for delete to authenticated using (mess_id = (select private.managed_mess_id()));

create policy "polls: members read" on public.polls
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "polls: creator or manager updates" on public.polls
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())
         or (created_by = (select auth.uid()) and mess_id = (select private.current_mess_id())))
  with check (mess_id = (select private.current_mess_id()));
create policy "polls: creator or manager deletes" on public.polls
  for delete to authenticated
  using (mess_id = (select private.managed_mess_id())
         or (created_by = (select auth.uid()) and mess_id = (select private.current_mess_id())));

create policy "poll_options: visible with poll" on public.poll_options
  for select to authenticated using (exists (select 1 from public.polls p where p.id = poll_id));

create policy "poll_votes: own" on public.poll_votes
  for select to authenticated using (user_id = (select auth.uid()));

create policy "notices: members read" on public.notices
  for select to authenticated using (mess_id = (select private.current_mess_id()));
create policy "notices: manager inserts" on public.notices
  for insert to authenticated with check (mess_id = (select private.managed_mess_id()));
create policy "notices: manager updates" on public.notices
  for update to authenticated
  using (mess_id = (select private.managed_mess_id())) with check (mess_id = (select private.managed_mess_id()));
create policy "notices: manager deletes" on public.notices
  for delete to authenticated using (mess_id = (select private.managed_mess_id()));

create policy "service_providers: approved, own, admin" on public.service_providers
  for select to authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "service_providers: suggest" on public.service_providers
  for insert to authenticated with check (owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "service_providers: owner or admin updates" on public.service_providers
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_super_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "service_providers: owner or admin deletes" on public.service_providers
  for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "service_reviews: signed-in users read" on public.service_reviews
  for select to authenticated using (true);
create policy "service_reviews: write own" on public.service_reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "service_reviews: update own" on public.service_reviews
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "service_reviews: delete own or admin" on public.service_reviews
  for delete to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "market_items: listed, own, admin" on public.market_items
  for select to authenticated
  using (status <> 'removed' or seller_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "market_items: sell own" on public.market_items
  for insert to authenticated with check (seller_id = (select auth.uid()));
create policy "market_items: seller or admin updates" on public.market_items
  for update to authenticated
  using (seller_id = (select auth.uid()) or (select private.is_super_admin()))
  with check (seller_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "market_items: seller or admin deletes" on public.market_items
  for delete to authenticated using (seller_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "market_item_photos: visible with item" on public.market_item_photos
  for select to authenticated using (exists (select 1 from public.market_items i where i.id = item_id));
create policy "market_item_photos: seller adds" on public.market_item_photos
  for insert to authenticated
  with check (exists (select 1 from public.market_items i where i.id = item_id and i.seller_id = (select auth.uid())));
create policy "market_item_photos: seller or admin removes" on public.market_item_photos
  for delete to authenticated
  using (exists (select 1 from public.market_items i where i.id = item_id and i.seller_id = (select auth.uid()))
         or (select private.is_super_admin()));

create policy "emergency_places: anyone can read" on public.emergency_places
  for select to anon, authenticated using (true);
create policy "emergency_places: super admin writes" on public.emergency_places
  for all to authenticated using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy "emergency_contacts: own" on public.emergency_contacts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "budget_entries: own" on public.budget_entries
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "monthly_budgets: own" on public.monthly_budgets
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------- care ------
-- Personal wellbeing data: owner only. No manager or admin access.
create policy "mood_checkins: own" on public.mood_checkins
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "care_alerts: owner or recipient" on public.care_alerts
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_care_recipient(id));
create policy "care_alert_recipients: own row or alert owner" on public.care_alert_recipients
  for select to authenticated
  using (user_id = (select auth.uid()) or private.owns_care_alert(alert_id));

create policy "safety_checkins: own" on public.safety_checkins
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reminders: own" on public.reminders
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "water_logs: own" on public.water_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "family_call_logs: own" on public.family_call_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "loans: own" on public.loans
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "loan_payments: own" on public.loan_payments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (exists (select 1 from public.loans l where l.id = loan_id and l.user_id = (select auth.uid())));

create policy "recipes: approved, own, admin" on public.recipes
  for select to authenticated
  using (status = 'approved' or created_by = (select auth.uid()) or (select private.is_super_admin()));
create policy "recipes: submit" on public.recipes
  for insert to authenticated with check (created_by = (select auth.uid()) or (select private.is_super_admin()));
create policy "recipes: author or admin updates" on public.recipes
  for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_super_admin()))
  with check (created_by = (select auth.uid()) or (select private.is_super_admin()));
create policy "recipes: author or admin deletes" on public.recipes
  for delete to authenticated using (created_by = (select auth.uid()) or (select private.is_super_admin()));

create policy "community_events: approved, own, admin" on public.community_events
  for select to authenticated
  using (status = 'approved' or organizer_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "community_events: organise" on public.community_events
  for insert to authenticated with check (organizer_id = (select auth.uid()));
create policy "community_events: organiser or admin updates" on public.community_events
  for update to authenticated
  using (organizer_id = (select auth.uid()) or (select private.is_super_admin()))
  with check (organizer_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "community_events: organiser or admin deletes" on public.community_events
  for delete to authenticated using (organizer_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "event_rsvps: own or organiser" on public.event_rsvps
  for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.community_events e where e.id = event_id and e.organizer_id = (select auth.uid())));
create policy "event_rsvps: join" on public.event_rsvps
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.community_events e where e.id = event_id));
create policy "event_rsvps: leave" on public.event_rsvps
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "job_posts: open, own, admin" on public.job_posts
  for select to authenticated
  using (status = 'open' or posted_by = (select auth.uid()) or (select private.is_super_admin()));
create policy "job_posts: post" on public.job_posts
  for insert to authenticated with check (posted_by = (select auth.uid()));
create policy "job_posts: poster or admin updates" on public.job_posts
  for update to authenticated
  using (posted_by = (select auth.uid()) or (select private.is_super_admin()))
  with check (posted_by = (select auth.uid()) or (select private.is_super_admin()));
create policy "job_posts: poster or admin deletes" on public.job_posts
  for delete to authenticated using (posted_by = (select auth.uid()) or (select private.is_super_admin()));

-- =============================================================================
-- Grants (defence in depth on top of RLS)
-- =============================================================================
-- Supabase projects created since May 2026 no longer grant the API roles access to
-- new tables ("Automatically expose new tables" is off by default). Grant it here
-- explicitly so setup works on any project; RLS still decides which rows a user
-- sees, and 0020 takes writes away again on tables that only RPCs may change.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Visitors who are not signed in may only read the public reference tables.
revoke all on all tables in schema public from anon;
grant select on public.areas, public.emergency_places to anon;

-- TRUNCATE ignores RLS; nobody but the owner should have it.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- RPCs: signed-in users only, except the public contact form.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.submit_feedback(public.feedback_type, text, text, text, text) to anon;
