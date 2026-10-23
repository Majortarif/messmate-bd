-- =============================================================================
-- MessMate BD · tests/functional.sql
-- End-to-end checks of the business rules: deposits and TrxID checks, fixed
-- price ordering with cutoff and balance, ledger immutability, bill splitting,
-- the auto meal rate and month close, membership flows, polls, Care alerts,
-- check-ins, loans, roommate score, moderation, data export and deletion.
--
-- Safe to run in the Supabase SQL editor: it builds its own throw-away data and
-- deletes it at the end. Checks that run the global cron jobs only run against
-- the local PGlite test database (they would touch real users otherwise).
-- Expected result: a single row "Functional: N checks passed".
-- =============================================================================

-- ------------------------------------------------------------ test harness --
drop schema if exists tests cascade;
create schema tests;
grant usage on schema tests to anon, authenticated;

create table tests.ids (key text primary key, id uuid not null default gen_random_uuid());

create function tests.id(p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v uuid;
begin
  select i.id into v from tests.ids i where i.key = p_key;
  if v is null then
    insert into tests.ids (key) values (p_key) returning id into v;
  end if;
  return v;
end;
$$;

create function tests.check(p_ok boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAIL: %', p_label;
  end if;
  perform set_config('tests.passed', (coalesce(nullif(current_setting('tests.passed', true), ''), '0')::int + 1)::text, false);
end;
$$;

create function tests.throws(p_sql text, p_pattern text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_pattern is null or sqlerrm ilike '%' || p_pattern || '%' then
      perform tests.check(true, p_label);
      return;
    end if;
    raise exception 'FAIL: % (expected error like "%", got "%")', p_label, p_pattern, sqlerrm;
  end;
  raise exception 'FAIL: % (expected an error, but it succeeded)', p_label;
end;
$$;

create function tests.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', tests.id(p_key), 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
end;
$$;

create function tests.logout() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end;
$$;

create function tests.create_user(p_key text, p_name text, p_terms boolean default true) returns uuid
language plpgsql as $$
declare
  v uuid := tests.id(p_key);
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated',
          lower(p_key) || '.' || left(v::text, 8) || '@tests.messmate.local', '', now(), '{}'::jsonb,
          jsonb_strip_nulls(jsonb_build_object('full_name', p_name, 'terms_version', case when p_terms then 'test' end)),
          now(), now(), '', '', '', '');
  return v;
end;
$$;

create function tests.code(p_key text) returns text
language sql security definer set search_path = '' as $$
  select m.invite_code from public.messes m where m.id = tests.id(p_key)
$$;

create function tests.prev() returns date
language sql stable as $$
  select (private.month_start(private.dhaka_today()) - interval '1 month')::date
$$;

-- True only in the local PGlite shim (no Supabase triggers on storage.objects).
create function tests.is_local() returns boolean
language sql stable as $$
  select not exists (select 1 from pg_trigger where tgrelid = 'storage.objects'::regclass and not tgisinternal)
$$;

select set_config('tests.passed', '0', false);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('FM', 'Fixed manager');
select tests.create_user('F1', 'Fixed member one');
select tests.create_user('F2', 'Fixed member two');
select tests.create_user('UM', 'Auto manager');
select tests.create_user('U1', 'Auto member one');
select tests.create_user('U2', 'Auto member two');
select tests.create_user('J',  'Joiner');
select tests.create_user('N',  'No terms yet', false);
select tests.create_user('S',  'Platform admin');
update public.profiles set platform_role = 'super_admin' where id = tests.id('S');

insert into public.messes (id, name, created_by) values
  (tests.id('messF'), 'Functional Fixed Mess', tests.id('FM')),
  (tests.id('messU'), 'Functional Auto Mess', tests.id('UM'));
insert into public.mess_settings (mess_id, meal_rate_mode) values
  (tests.id('messF'), 'fixed'), (tests.id('messU'), 'auto');
insert into public.mess_members (mess_id, user_id, role, status, joined_at) values
  (tests.id('messF'), tests.id('FM'), 'manager', 'active', now() - interval '70 days'),
  (tests.id('messF'), tests.id('F1'), 'member',  'active', now() - interval '70 days'),
  (tests.id('messF'), tests.id('F2'), 'member',  'active', now() - interval '70 days'),
  (tests.id('messU'), tests.id('UM'), 'manager', 'active', now() - interval '70 days'),
  (tests.id('messU'), tests.id('U1'), 'member',  'active', now() - interval '70 days'),
  (tests.id('messU'), tests.id('U2'), 'member',  'active', now() - interval '70 days');

-- =========================================================== 1. deposits ===
select tests.login('F1');
select tests.check(public.submit_deposit(1000, 'bkash', 'abc 123 xyz', '01000000000') is not null, 'member submits a bKash deposit');
select tests.check((select trx_id from public.deposit_requests where user_id = tests.id('F1')) = 'ABC123XYZ', 'TrxID is normalised');
select tests.throws($q$select public.submit_deposit(1000, 'bkash', 'ABC123XYZ')$q$, 'duplicate_trx_id', 'same TrxID cannot be claimed twice');
select tests.throws($q$select public.submit_deposit(5, 'cash')$q$, 'invalid_amount', 'tiny deposit rejected');
select tests.throws($q$select public.submit_deposit(500, 'nagad')$q$, 'trx_id_required', 'mobile banking needs a TrxID');
select tests.throws($q$select public.submit_deposit(500, 'nagad', 'bad-id!')$q$, 'invalid_trx_id', 'malformed TrxID rejected');
select tests.check((public.get_wallet_summary() ->> 'pending_amount')::numeric = 1000, 'pending deposit is not balance yet');

select tests.login('FM');
select tests.check((select count(*) from public.notifications where type = 'deposit_submitted') = 1, 'manager notified of the deposit');
select tests.check(public.review_deposit((select id from public.deposit_requests where trx_id = 'ABC123XYZ'), true) is not null,
                   'manager approves the deposit');
select tests.throws(format('select public.review_deposit(%L, true)', (select id from public.deposit_requests where trx_id = 'ABC123XYZ')),
                    'already_reviewed', 'a request is reviewed only once');

select tests.login('F1');
select tests.check((public.get_wallet_summary() ->> 'balance')::numeric = 1000, 'approved money lands in the wallet');
select tests.check((select count(*) from public.notifications where type = 'deposit_approved') = 1, 'member told the deposit was approved');

-- ============================================ 2. fixed-price meal ordering ===
select tests.logout();
insert into public.menus (id, mess_id, menu_date, slot, items, price) values
  (tests.id('menuL'), tests.id('messF'), private.dhaka_today() + 1, 'lunch', 'ভাত, মুরগি', 80),
  (tests.id('menuD'), tests.id('messF'), private.dhaka_today() + 1, 'dinner', 'বিরিয়ানি', 2000);
insert into public.menus (id, mess_id, menu_date, slot, items, price, cutoff_at) values
  (tests.id('menuPast'), tests.id('messF'), private.dhaka_today(), 'breakfast', 'রুটি', 30, now() - interval '1 hour');
select tests.check((select cutoff_at from public.menus where id = tests.id('menuL')) = private.dhaka_ts(private.dhaka_today() + 1, '10:00'),
                   'cutoff defaults to the mess setting (10:00 Dhaka)');

select tests.login('F1');
select tests.check((public.set_meal_order(tests.id('menuL'), true, 1) ->> 'charged_amount')::numeric = 160, 'meal + 1 guest charged at menu price');
select tests.check((public.get_wallet_summary() ->> 'balance')::numeric = 840, 'order reduces the balance');
select tests.check((public.set_meal_order(tests.id('menuL'), true, 0) ->> 'balance')::numeric = 920, 'removing the guest refunds the difference');
select tests.check((public.set_meal_order(tests.id('menuL'), false) ->> 'status') = 'cancelled', 'member cancels before cutoff');
select tests.check((public.get_wallet_summary() ->> 'balance')::numeric = 1000, 'cancellation refunds in full');
select tests.throws(format('select public.set_meal_order(%L, true, 5)', tests.id('menuL')), 'too_many_guests', 'guest limit enforced');
select tests.throws(format('select public.set_meal_order(%L, true)', tests.id('menuD')), 'insufficient_balance', 'cannot order beyond the balance');
select tests.throws(format('select public.set_meal_order(%L, true)', tests.id('menuPast')), 'cutoff_passed', 'member cannot order after cutoff');

select tests.login('F2');
select tests.throws(format('select public.set_meal_order(%L, true, 0, %L)', tests.id('menuL'), tests.id('F1')),
                    'not_manager', 'member cannot order for someone else');

select tests.login('FM');
select tests.check((public.set_meal_order(tests.id('menuPast'), true, 0, tests.id('F1')) ->> 'charged_amount')::numeric = 30,
                   'manager can add a meal after cutoff');
select tests.throws(format('update public.menus set price = 50 where id = %L', tests.id('menuPast')), 'menu_price_locked', 'price locked once charged');
select tests.throws(format('delete from public.menus where id = %L', tests.id('menuPast')), 'menu_has_orders', 'menu with orders cannot be deleted');
select tests.check((select total from public.get_meal_headcount(private.dhaka_today()) where slot = 'breakfast') = 1, 'kitchen headcount');

select tests.logout();
select tests.throws(format('update public.ledger_entries set amount = 1 where user_id = %L', tests.id('F1')), 'ledger_immutable',
                    'ledger rows cannot be edited, even by the owner');
select tests.throws(format('delete from public.ledger_entries where user_id = %L', tests.id('F1')), 'ledger_immutable',
                    'ledger rows cannot be deleted');
select tests.check((select balance from public.member_balances where user_id = tests.id('F1')) = 970, 'balance is the sum of the ledger');

-- ========================================== 3. manager entries + reversal ===
select tests.login('FM');
select tests.check(public.manager_ledger_entry(tests.id('F1'), 'adjustment', -800, 'ভুল সংশোধন') is not null, 'manager posts an adjustment');
select tests.throws(format($q$select public.manager_ledger_entry(%L, 'adjustment', 10)$q$, tests.id('F1')), 'reason_required', 'adjustments need a reason');
select tests.throws(format($q$select public.manager_ledger_entry(%L, 'meal_charge', -10, 'x')$q$, tests.id('F1')), 'invalid_type', 'manager cannot fake meal charges');
select tests.login('F1');
select tests.check((select count(*) from public.notifications where type = 'low_balance') = 1, 'low-balance alert fires when crossing the threshold');

select tests.login('FM');
select tests.check(public.reverse_ledger_entry((select id from public.ledger_entries where user_id = tests.id('F1') and entry_type = 'adjustment'),
                                               'ভুল এন্ট্রি') is not null, 'manager reverses the adjustment');
select tests.throws(format('select public.reverse_ledger_entry(%L, %L)',
                           (select id from public.ledger_entries where user_id = tests.id('F1') and entry_type = 'adjustment'), 'again'),
                    'already_reversed', 'an entry is reversed only once');
select tests.throws(format('select public.reverse_ledger_entry(%L, %L)',
                           (select id from public.ledger_entries where user_id = tests.id('F1') and entry_type = 'meal_charge' limit 1), 'nope'),
                    'not_reversible', 'meal charges are corrected by cancelling, not reversing');
select tests.check((select sum(amount) from public.ledger_entries where user_id = tests.id('F1')) = 970, 'reversal restores the balance');
select tests.check(public.manager_ledger_entry(tests.id('F2'), 'deposit', 400, 'হাতে নগদ') is not null, 'manager records cash in hand');
select tests.throws(format($q$update public.mess_settings set meal_rate_mode = 'auto' where mess_id = %L$q$, tests.id('messF')),
                    'mode_change_blocked', 'meal-rate mode cannot change while the open month has orders');
update public.mess_settings set lunch_price = 85 where mess_id = tests.id('messF');
select tests.check((select lunch_price from public.mess_settings where mess_id = tests.id('messF')) = 85, 'manager updates other meal settings');
select tests.check((select status from public.deposit_requests where user_id = tests.id('F2')) = 'approved', 'cash deposit appears in history');

-- ============================= 4. bills, auto meal rate and month closing ===
select tests.logout();
insert into public.menus (id, mess_id, menu_date, slot, items)
select tests.id('um' || d || s), tests.id('messU'), tests.prev() + d, s::public.meal_slot, 'test menu'
  from generate_series(0, 1) d cross join unnest(array['breakfast', 'lunch', 'dinner']) s;
-- U1 eats all six meals: 2 × (0.5 + 1 + 1) = 5 units
insert into public.meal_orders (mess_id, menu_id, user_id)
select tests.id('messU'), tests.id('um' || d || s), tests.id('U1')
  from generate_series(0, 1) d cross join unnest(array['breakfast', 'lunch', 'dinner']) s;
-- U2: lunch (1) + dinner with one guest (2) = 3 units
insert into public.meal_orders (mess_id, menu_id, user_id, guest_count) values
  (tests.id('messU'), tests.id('um0lunch'), tests.id('U2'), 0),
  (tests.id('messU'), tests.id('um0dinner'), tests.id('U2'), 1);
insert into public.expenses (mess_id, category, amount, expense_date, added_by) values
  (tests.id('messU'), 'bazar', 600, tests.prev(), tests.id('UM')),
  (tests.id('messU'), 'cleaning', 90, tests.prev() + 1, tests.id('UM'));
insert into public.expenses (mess_id, category, amount, expense_date, paid_from, paid_by, added_by) values
  (tests.id('messU'), 'cooking_gas', 200, tests.prev() + 1, 'member', tests.id('U2'), tests.id('UM'));
insert into public.ledger_entries (mess_id, user_id, entry_type, amount, period_month) values
  (tests.id('messU'), tests.id('U1'), 'deposit', 1000, tests.prev()),
  (tests.id('messU'), tests.id('U2'), 'deposit', 500, tests.prev());
insert into public.bills (id, mess_id, bill_type, period_month, total_amount, split_mode) values
  (tests.id('wifiU'), tests.id('messU'), 'wifi', tests.prev(), 300, 'equal'),
  (tests.id('waterU'), tests.id('messU'), 'water', tests.prev(), 100, 'equal'),
  (tests.id('elecU'), tests.id('messU'), 'electricity', tests.prev(), 250, 'custom');
select tests.check((select reimbursement_entry_id from public.expenses where paid_from = 'member' and mess_id = tests.id('messU')) is not null,
                   'member who paid from pocket is reimbursed');

select tests.login('UM');
select tests.check(public.post_bill(tests.id('wifiU')) = 3, 'equal split: one share per member');
select tests.check(public.post_bill(tests.id('waterU')) = 3, 'water bill posted');
select tests.check((select sum(amount) from public.bill_shares where bill_id = tests.id('waterU')) = 100
                   and (select max(amount) - min(amount) from public.bill_shares where bill_id = tests.id('waterU')) = 0.01,
                   '৳100 ÷ 3 spreads the paisa remainder fairly');
select tests.throws(format('select public.post_bill(%L, %L::jsonb)', tests.id('elecU'),
                           jsonb_build_array(jsonb_build_object('user_id', tests.id('U1'), 'amount', 100),
                                             jsonb_build_object('user_id', tests.id('U2'), 'amount', 100))),
                    'custom_split_mismatch', 'custom split must add up to the bill');
select tests.check(public.post_bill(tests.id('elecU'), jsonb_build_array(jsonb_build_object('user_id', tests.id('U1'), 'amount', 150),
                                                                         jsonb_build_object('user_id', tests.id('U2'), 'amount', 100))) = 2,
                   'custom split posts');
select tests.throws(format('select public.post_bill(%L)', tests.id('wifiU')), 'bill_not_draft', 'a bill is posted only once');
select tests.throws(format('update public.bills set total_amount = 1 where id = %L', tests.id('wifiU')), 'bill_not_draft', 'posted bills are locked');

select tests.login('U1');
select tests.throws(format('select public.close_month(%L, %L)', tests.id('messU'), tests.prev()), 'not_manager', 'member cannot close the month');
select tests.login('UM');
select tests.throws(format('select public.close_month(%L, %L)', tests.id('messU'), private.dhaka_today()), 'month_not_finished',
                    'the running month cannot be closed');
select tests.check(public.close_month(tests.id('messU'), tests.prev()) is not null, 'manager closes last month');
select tests.check((select meal_rate from public.monthly_closings where mess_id = tests.id('messU')) = 100,
                   'meal rate = (৳600 bazar + ৳200 gas) ÷ 8 units');
select tests.check((select total_meal_units from public.monthly_closings where mess_id = tests.id('messU')) = 8,
                   'units count guests and half breakfasts');
select tests.check((select meal_cost from public.member_statements where user_id = tests.id('U1')) = 500, 'U1 pays 5 units × ৳100');
select tests.check((select meal_cost from public.member_statements where user_id = tests.id('U2')) = 300, 'U2 pays 3 units × ৳100');
select tests.check((select other_net from public.member_statements where user_id = tests.id('U2')) = 200, 'U2 credited for the gas');
select tests.check((select bill_cost from public.member_statements where user_id = tests.id('UM'))
                   = 100 + 30 + (select amount from public.bill_shares where bill_id = tests.id('waterU') and user_id = tests.id('UM')),
                   'manager share = wifi + water + ৳90 cleaning ÷ 3');
select tests.check(not exists (
                     select 1 from public.member_statements ms
                      where ms.mess_id = tests.id('messU')
                        and ms.closing_balance <> (select sum(l.amount) from public.ledger_entries l
                                                    where l.mess_id = ms.mess_id and l.user_id = ms.user_id
                                                      and l.period_month <= tests.prev())),
                   'every statement balance matches the ledger to the paisa');
select tests.throws(format('select public.close_month(%L, %L)', tests.id('messU'), tests.prev()), 'month_already_closed', 'a month closes once');
select tests.throws(format($q$insert into public.expenses (mess_id, amount, expense_date) values (%L, 50, %L)$q$, tests.id('messU'), tests.prev() + 2),
                    'month_closed', 'closed month rejects new expenses');
select tests.throws(format($q$update public.menus set items = 'x' where id = %L$q$, tests.id('um0lunch')), 'month_closed', 'closed month menus are frozen');
select tests.check((public.get_manager_dashboard(tests.prev()) ->> 'month_closed')::boolean, 'manager dashboard shows the closed month');
select tests.check((public.get_manager_dashboard(tests.prev()) -> 'totals' ->> 'meal_rate')::numeric = 100, 'dashboard uses the closing rate');

select tests.login('U1');
select tests.check((public.get_member_dashboard(tests.prev()) -> 'meals' ->> 'my_meal_cost')::numeric = 500, 'member dashboard shows the final meal cost');
select tests.check(jsonb_typeof(public.get_member_dashboard() -> 'upcoming_menus') = 'array', 'member dashboard lists upcoming menus');

select tests.logout();
select tests.throws(format($q$insert into public.ledger_entries (mess_id, user_id, entry_type, amount, period_month) values (%L, %L, 'deposit', 10, %L)$q$,
                           tests.id('messU'), tests.id('U1'), tests.prev()),
                    'month_closed', 'ledger refuses entries for a closed month');

-- ====================================================== 5. membership flow ===
select tests.login('J');
select tests.check((select name from public.get_mess_by_invite(tests.code('messU'))) = 'Functional Auto Mess', 'invite code shows the mess card');
select tests.check(public.request_join(tests.code('messU'), 'একটা সিট লাগবে') is not null, 'join request with invite code');
select tests.throws(format('select public.request_join(%L)', tests.code('messF')), 'already_in_mess', 'one open membership at a time');

select tests.login('UM');
select tests.check((select count(*) from public.notifications where type = 'join_request') = 1, 'manager notified of the join request');
select public.decide_join_request((select id from public.mess_members where user_id = tests.id('J') and status = 'pending'), true);

select tests.login('J');
select tests.check((public.get_member_dashboard() ->> 'has_mess')::boolean, 'approved member gets the mess dashboard');
select public.leave_mess();
select tests.check(not (public.get_member_dashboard() ->> 'has_mess')::boolean, 'member can leave');
select tests.check(public.request_join(tests.code('messU')) is not null, 'after leaving, a new request is allowed');
select public.cancel_join_request();

select tests.login('UM');
select tests.throws('select public.leave_mess()', 'last_manager', 'the last manager cannot walk away');
insert into public.mess_rooms (id, mess_id, room_label, capacity) values (tests.id('roomSmall'), tests.id('messU'), 'S-1', 1);
select public.update_member((select id from public.mess_members where user_id = tests.id('U1') and status = 'active'),
                            p_room_id => tests.id('roomSmall'));
select tests.throws(format('select public.update_member(%L, p_room_id => %L)',
                           (select id from public.mess_members where user_id = tests.id('U2') and status = 'active'), tests.id('roomSmall')),
                    'room_full', 'room capacity enforced');
select tests.throws(format($q$select public.update_member(%L, p_role => 'member')$q$,
                           (select id from public.mess_members where user_id = tests.id('UM') and status = 'active')),
                    'last_manager', 'the only manager cannot demote themself');

select tests.login('N');
select tests.throws($q$select public.create_mess('নতুন মেস')$q$, 'terms_not_accepted', 'terms must be accepted first');
select public.accept_legal('2026-10');
select tests.check(public.create_mess('নতুন মেস') is not null, 'a new user creates a mess');
select tests.check((select role from public.mess_members where user_id = tests.id('N')) = 'manager', 'creator becomes its manager');

-- ========================================================== 6. rate limit ===
select tests.login('F2');
do $$
begin
  for i in 1..10 loop
    perform public.submit_feedback('feedback', 'test message number ' || i);
  end loop;
end;
$$;
select tests.throws($q$select public.submit_feedback('bug', 'one message too many')$q$, 'rate_limited', 'feedback is rate limited');

-- =============================================================== 7. polls ===
select tests.login('U1');
select set_config('tests.poll', public.create_poll('আজ রাতে কী খাবো?', array['খিচুড়ি', 'ভাত-মাছ'])::text, false);
select tests.throws(format('select public.cast_vote(%L, array(select id from public.poll_options where poll_id = %L))',
                           current_setting('tests.poll'), current_setting('tests.poll')),
                    'single_choice_only', 'single-choice poll takes one option');
select public.cast_vote(current_setting('tests.poll')::uuid,
                        array(select id from public.poll_options where poll_id = current_setting('tests.poll')::uuid and label = 'খিচুড়ি'));
select tests.login('U2');
select public.cast_vote(current_setting('tests.poll')::uuid,
                        array(select id from public.poll_options where poll_id = current_setting('tests.poll')::uuid and label = 'ভাত-মাছ'));
select public.cast_vote(current_setting('tests.poll')::uuid,
                        array(select id from public.poll_options where poll_id = current_setting('tests.poll')::uuid and label = 'খিচুড়ি'));
select tests.check((select votes from public.poll_results(current_setting('tests.poll')::uuid) where label = 'খিচুড়ি') = 2
                   and (select votes from public.poll_results(current_setting('tests.poll')::uuid) where label = 'ভাত-মাছ') = 0,
                   'changing a vote replaces the old one');
select tests.login('F1');
select tests.throws(format($q$select public.cast_vote(%L, '{}'::uuid[])$q$, current_setting('tests.poll')), 'not_member', 'other mess cannot vote');

-- ================================================================ 8. Care ===
select tests.login('U1');
insert into public.emergency_contacts (name, relation, phone, contact_user_id) values ('U2 ভাই', 'রুমমেট', '01000000002', tests.id('U2'));
insert into public.emergency_contacts (name, relation, phone) values ('আম্মা', 'মা', '01000000004');
select tests.throws(format($q$insert into public.emergency_contacts (name, phone, contact_user_id) values ('x', '01000000003', %L)$q$, tests.id('F1')),
                    'contact_must_be_messmate', 'in-app contacts must be messmates');
select set_config('tests.alert', public.raise_care_alert('sick', 'জ্বর এসেছে', array['light_food', 'medicine']) ->> 'alert_id', false);
select tests.check((select count(*) from public.care_alert_recipients where alert_id = current_setting('tests.alert')::uuid) = 2,
                   'sick mode reaches messmates and linked contacts once each');
select tests.throws($q$select public.raise_care_alert('sick')$q$, 'alert_already_active', 'no duplicate alert spam');
select tests.check(jsonb_array_length(public.raise_care_alert('sos', 'help', '{}', null, null, null, false) -> 'external_contacts') = 1,
                   'outside contacts returned for WhatsApp / SMS');

select tests.login('U2');
select tests.check((select count(*) from public.care_alerts) = 2, 'recipient sees both alerts');
select tests.check((select count(*) from public.notifications where type = 'care_sick' and body like '%হালকা খাবার%') = 1,
                   'sick alert says light food is needed');
select public.respond_care_alert(current_setting('tests.alert')::uuid, 'on_my_way');

select tests.login('F1');
select tests.check((select count(*) from public.care_alerts) = 0, 'other mess cannot see Care alerts');
select tests.throws(format('select public.respond_care_alert(%L, %L)', current_setting('tests.alert'), 'called'), 'not_found',
                    'only recipients can respond');

select tests.login('U1');
select tests.check((select status from public.care_alerts where id = current_setting('tests.alert')::uuid) = 'acknowledged', 'alert acknowledged');
select tests.check((select count(*) from public.notifications where type = 'care_response') = 1, 'owner told someone is coming');
select public.resolve_care_alert(current_setting('tests.alert')::uuid);
select tests.check((select status from public.care_alerts where id = current_setting('tests.alert')::uuid) = 'resolved', 'owner resolves the alert');

insert into public.safety_checkins (label, expected_by) values ('অফিস থেকে বাসা', now() + interval '1 hour');
select tests.throws($q$insert into public.safety_checkins (label, expected_by) values ('x', now() - interval '1 hour')$q$,
                    'invalid_expected_time', 'check-in time must be in the future');
insert into public.reminders (reminder_type, title, remind_at)
values ('medicine', 'প্রেশারের ওষুধ', ((now() at time zone 'Asia/Dhaka') - interval '1 minute')::time);
insert into public.mood_checkins (mood, note, user_id) values ('sad', 'বাড়ির কথা মনে পড়ছে', tests.id('U1'));
select tests.check((public.get_member_dashboard() -> 'care' ->> 'mood_today') = 'sad', 'dashboard shows today''s mood');

-- cron jobs touch every user, so only exercise them on the local test database
do $$
begin
  if not tests.is_local() then
    return;
  end if;
  perform tests.logout();
  update public.safety_checkins set expected_by = now() - interval '1 minute'
   where user_id = tests.id('U1') and status = 'pending';
  perform tests.check((private.process_due_jobs() ->> 'overdue_checkins')::int = 1, 'cron flags the overdue check-in');
  perform tests.check(exists (select 1 from public.notifications where user_id = tests.id('U2') and type = 'checkin_overdue'),
                      'trusted messmate alerted about the missed check-in');
  perform tests.check(exists (select 1 from public.notifications where user_id = tests.id('U1') and type = 'reminder'),
                      'due medicine reminder delivered');
  perform tests.check((private.process_due_jobs() ->> 'reminders_sent')::int = 0, 'a reminder is sent once per day');
  perform tests.login('U1');
  update public.safety_checkins set status = 'arrived' where status = 'overdue';
  perform tests.logout();
  perform tests.check(exists (select 1 from public.notifications where user_id = tests.id('U2') and type = 'checkin_arrived'),
                      'contact told they arrived safely');
  perform tests.check(private.run_daily_jobs() ? 'months_closed', 'daily job runs');
end;
$$;

-- ================================================================ 9. loans ===
select tests.login('U1');
insert into public.loans (direction, counterparty_name, amount, repaid_amount) values ('lent', 'বন্ধু', 500, 400);
select tests.check((select repaid_amount from public.loans) = 0, 'repaid amount only comes from payments');
insert into public.loan_payments (loan_id, amount) select id, 200 from public.loans;
select tests.throws($q$insert into public.loan_payments (loan_id, amount) select id, 400 from public.loans$q$,
                    'payment_exceeds_loan', 'cannot repay more than borrowed');
insert into public.loan_payments (loan_id, amount) select id, 300 from public.loans;
select tests.check((select status from public.loans) = 'settled', 'loan settles when fully repaid');

-- ======================================================= 10. roommates ===
insert into public.roommate_profiles (user_id, gender, occupation, budget_min, budget_max)
values (tests.id('U1'), 'male', 'student', 3000, 5000);
insert into public.roommate_area_prefs (user_id, area_id) select tests.id('U1'), id from public.areas where slug = 'mirpur';
select tests.login('F2');
insert into public.roommate_profiles (user_id, gender, occupation, budget_min, budget_max)
values (tests.id('F2'), 'female', 'student', 3000, 5000);
select tests.login('U2');
insert into public.roommate_profiles (user_id, gender, occupation, budget_min, budget_max)
values (tests.id('U2'), 'male', 'student', 4000, 6000);
insert into public.roommate_area_prefs (user_id, area_id) select tests.id('U2'), id from public.areas where slug = 'mirpur';
select tests.check((select score from public.roommate_matches() where user_id = tests.id('U1')) = 100, 'matching preferences score 100');
select tests.check(not exists (select 1 from public.roommate_matches() where user_id = tests.id('F2')), 'matches are same-gender only');
select tests.check((select contact_phone from public.roommate_matches() where user_id = tests.id('U1')) is null, 'phone hidden unless shared');
select tests.check((select count(*) from public.roommate_profiles) = 1, 'roommate profiles are private rows');

-- ========================================================= 11. chores ===
select tests.login('UM');
select tests.check(public.generate_chore_roster('bazar', 'বাজার', private.dhaka_today(), 6, array[tests.id('U1'), tests.id('U2')]) = 6,
                   'bazar roster generated');
select tests.check((select count(*) from public.chores where assigned_to = tests.id('U1')) = 3, 'roster alternates fairly');
select tests.throws(format($q$select public.generate_chore_roster('bazar', 'x', %L, 3, array[%L]::uuid[])$q$, private.dhaka_today(), tests.id('F1')),
                    'assignee_not_member', 'only members can be on the roster');
select tests.login('U1');
update public.chores set status = 'done', title = 'changed' where assigned_to = tests.id('U1') and due_date = private.dhaka_today();
select tests.check((select title = 'বাজার' and status = 'done' and done_at is not null from public.chores
                     where assigned_to = tests.id('U1') and due_date = private.dhaka_today()),
                   'assignee can only tick off their own duty');

-- ===================================================== 12. moderation ===
insert into public.listings (owner_id, listing_type, title, area_id, rent, contact_phone, status)
select tests.id('U1'), 'seat', 'মিরপুরে একটি সিট খালি', id, 3000, '01000000001', 'approved' from public.areas where slug = 'mirpur';
select tests.check((select status from public.listings where owner_id = tests.id('U1')) = 'pending', 'new listings wait for review');
select tests.login('F1');
select tests.check((select count(*) from public.listings where owner_id = tests.id('U1')) = 0, 'pending listing hidden from others');
select tests.throws($q$select public.moderate_content('listing', gen_random_uuid(), 'approved')$q$, 'not_super_admin', 'only admins moderate');
select tests.login('S');
select public.moderate_content('listing', (select id from public.listings where owner_id = tests.id('U1')), 'approved');
select tests.login('F1');
select tests.check((select count(*) from public.listings where owner_id = tests.id('U1')) = 1, 'approved listing is visible');
select tests.login('U1');
select tests.check((select count(*) from public.notifications where type = 'moderation') = 1, 'owner told the listing is live');
update public.listings set rent = 3500 where owner_id = tests.id('U1');
select tests.check((select status from public.listings where owner_id = tests.id('U1')) = 'pending', 'editing content sends it back to review');

-- ========================================= 13. export + delete my account ===
select tests.login('U2');
select tests.check(jsonb_array_length(public.export_my_data() -> 'ledger') > 0, 'export includes my ledger');
select tests.check((public.delete_my_account_data() ->> 'ok')::boolean, 'account data deletion runs');
select tests.logout();
select tests.check((select is_deleted and full_name = 'মুছে ফেলা ব্যবহারকারী' from public.profiles where id = tests.id('U2')), 'profile anonymised');
select tests.check((select status from public.mess_members where user_id = tests.id('U2') order by created_at desc limit 1) = 'left',
                   'membership closed');
select tests.check((select count(*) from public.ledger_entries where user_id = tests.id('U2')) > 0, 'mess ledger kept so the others still balance');
select tests.check((select count(*) from public.roommate_profiles where user_id = tests.id('U2')) = 0, 'personal data removed');
select tests.check((select count(*) from public.emergency_contacts where contact_user_id = tests.id('U2')) = 0, 'links from other users cleared');

-- ------------------------------------------------------------- clean up ----
select tests.logout();
delete from public.feedback where user_id in (select id from tests.ids);
select private.purge_data(
  array(select id from public.messes where id in (tests.id('messF'), tests.id('messU')) or created_by = tests.id('N')),
  array(select tests.id(k) from unnest(array['FM', 'F1', 'F2', 'UM', 'U1', 'U2', 'J', 'N', 'S']) k));
select set_config('tests.result', 'Functional: ' || current_setting('tests.passed') || ' checks passed', false);
drop schema tests cascade;
select current_setting('tests.result') as result;
