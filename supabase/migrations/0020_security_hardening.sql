-- =============================================================================
-- MessMate BD · 0020 · Security hardening (Phase 9 review)
--
-- 1. get_public_profiles returned the FULL name of any user id to any signed-in
--    user. Community posts expose user ids, so it undid the short-name privacy
--    of 0018 ("Rafi A." for strangers). The app uses get_display_names instead,
--    so the old function is removed.
-- 2. Supabase grants INSERT / UPDATE / DELETE on every public table to the
--    `authenticated` role. RLS already blocks them where no policy allows the
--    command, but these tables are written only through SECURITY DEFINER RPCs,
--    so the grants are revoked as a second lock. tests/rls_isolation.sql checks
--    that no table keeps a write grant without a matching policy.
-- Safe to run once; re-running is harmless.
-- =============================================================================

drop function if exists public.get_public_profiles(uuid[]);

-- Money and audit trail: RPC-only, append-only.
revoke insert, update, delete on public.ledger_entries     from anon, authenticated;
revoke insert, update, delete on public.deposit_requests   from anon, authenticated;
revoke insert, update, delete on public.monthly_closings   from anon, authenticated;
revoke insert, update, delete on public.member_statements  from anon, authenticated;
revoke insert, update, delete on public.bill_shares        from anon, authenticated;
revoke insert, update, delete on public.meal_orders        from anon, authenticated;
revoke insert, update, delete on public.audit_logs         from anon, authenticated;
revoke insert, update, delete on public.legal_acceptances  from anon, authenticated;

-- Membership, polls and Care alerts: RPC-only.
revoke insert, update, delete on public.mess_members          from anon, authenticated;
revoke insert, update, delete on public.poll_options          from anon, authenticated;
revoke insert, update, delete on public.poll_votes            from anon, authenticated;
revoke insert, update, delete on public.care_alerts           from anon, authenticated;
revoke insert, update, delete on public.care_alert_recipients from anon, authenticated;
revoke insert                 on public.messes                from anon, authenticated;
revoke insert                 on public.polls                 from anon, authenticated;
revoke insert, delete         on public.mess_settings         from anon, authenticated;
revoke insert, delete         on public.feedback              from anon, authenticated;
revoke insert, update         on public.notifications         from anon, authenticated;
revoke delete                 on public.profiles              from anon, authenticated;

-- Rows that are written once and never edited by users.
revoke update, delete on public.complaint_updates  from anon, authenticated;
revoke update         on public.event_rsvps        from anon, authenticated;
revoke update         on public.listing_photos     from anon, authenticated;
revoke update         on public.market_item_photos from anon, authenticated;
