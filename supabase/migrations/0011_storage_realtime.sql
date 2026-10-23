-- =============================================================================
-- MessMate BD · 0011 · Storage buckets + policies, Realtime publication
--
-- Path conventions (first folder = owner scope, checked by the policies):
--   avatars/          {user_id}/avatar.webp                  public
--   listing-photos/   {user_id}/{listing_id}/{n}.webp         public
--   market-photos/    {user_id}/{item_id}/{n}.webp            public
--   receipts/         {mess_id}/{expense_id}.webp             mess members read, manager writes
--   deposit-proofs/   {mess_id}/{user_id}/{file}              owner + manager read
--   complaint-photos/ {mess_id}/{user_id}/{file}              mess members read
--   personal/         {user_id}/...                           owner only (move-out photos etc.)
-- The app compresses images in the browser before upload to stay in the free tier.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',          'avatars',          true,  2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('listing-photos',   'listing-photos',   true,  3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('market-photos',    'market-photos',    true,  3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts',         'receipts',         false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('deposit-proofs',   'deposit-proofs',   false, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('complaint-photos', 'complaint-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('personal',         'personal',         false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ------------------------------------------------ own-folder public buckets --
create policy "storage: public photos readable by signed-in users" on storage.objects
  for select to authenticated
  using (bucket_id in ('avatars', 'listing-photos', 'market-photos'));

create policy "storage: upload to own folder (public buckets)" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'listing-photos', 'market-photos', 'personal')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "storage: update own files" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'listing-photos', 'market-photos', 'personal')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('avatars', 'listing-photos', 'market-photos', 'personal')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "storage: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'listing-photos', 'market-photos', 'personal')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "storage: read own personal files" on storage.objects
  for select to authenticated
  using (bucket_id = 'personal' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- --------------------------------------------------------------- receipts --
create policy "storage: mess members read receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select private.current_mess_id())::text);

create policy "storage: manager uploads receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select private.managed_mess_id())::text);

create policy "storage: manager deletes receipts" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select private.managed_mess_id())::text);

-- --------------------------------------------------------- deposit proofs --
create policy "storage: member uploads own deposit proof" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'deposit-proofs'
              and (storage.foldername(name))[1] = (select private.current_mess_id())::text
              and (storage.foldername(name))[2] = (select auth.uid())::text);

create policy "storage: owner or manager reads deposit proof" on storage.objects
  for select to authenticated
  using (bucket_id = 'deposit-proofs'
         and ((storage.foldername(name))[2] = (select auth.uid())::text
              or (storage.foldername(name))[1] = (select private.managed_mess_id())::text));

-- ------------------------------------------------------- complaint photos --
create policy "storage: member uploads complaint photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'complaint-photos'
              and (storage.foldername(name))[1] = (select private.current_mess_id())::text
              and (storage.foldername(name))[2] = (select auth.uid())::text);

create policy "storage: mess members read complaint photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'complaint-photos' and (storage.foldername(name))[1] = (select private.current_mess_id())::text);

-- =============================================================================
-- Realtime: live notifications, notices, approvals, orders and Care alerts.
-- Supabase Realtime applies each subscriber's RLS, so isolation still holds.
-- =============================================================================
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['notifications', 'notices', 'deposit_requests', 'meal_orders',
                           'care_alerts', 'care_alert_recipients', 'complaints', 'chores'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
