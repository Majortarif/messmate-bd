-- =============================================================================
-- MessMate BD · tests/rls_isolation.sql
-- Proves that one mess can never read or change another mess's data, that
-- members cannot do manager actions, and that private Care data stays private.
--
-- Safe to run in the Supabase SQL editor on a real project: it creates its own
-- throw-away users and messes, runs every check, then deletes what it created.
-- The whole script is one transaction — on any failure it stops with
-- "FAIL: <what>" and nothing is kept.
-- Expected result: a single row "RLS isolation: N checks passed".
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

create function tests.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  perform set_config('role', 'anon', false);
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

-- Storage rows can only be created/removed by plain SQL in the local PGlite
-- shim; on Supabase the storage tables are protected, so those checks skip.
create function tests.local_storage() returns boolean
language sql stable as $$
  select not exists (select 1 from pg_trigger where tgrelid = 'storage.objects'::regclass and not tgisinternal)
$$;

select set_config('tests.passed', '0', false);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('A1', 'Mess A manager');
select tests.create_user('A2', 'Mess A member');
select tests.create_user('B1', 'Mess B manager');
select tests.create_user('B2', 'Mess B member');
select tests.create_user('P',  'Pending applicant');
select tests.create_user('X',  'Outsider');
select tests.create_user('S',  'Platform admin');
update public.profiles set platform_role = 'super_admin' where id = tests.id('S');

insert into public.messes (id, name, created_by) values
  (tests.id('messA'), 'RLS Test Mess A', tests.id('A1')),
  (tests.id('messB'), 'RLS Test Mess B', tests.id('B1'));
insert into public.mess_settings (mess_id, meal_rate_mode) values
  (tests.id('messA'), 'auto'), (tests.id('messB'), 'fixed');
insert into public.mess_rooms (id, mess_id, room_label, capacity) values
  (tests.id('roomA'), tests.id('messA'), 'A-101', 2),
  (tests.id('roomB'), tests.id('messB'), 'B-101', 2);
insert into public.mess_members (id, mess_id, user_id, role, status, joined_at) values
  (tests.id('memA1'), tests.id('messA'), tests.id('A1'), 'manager', 'active', now() - interval '40 days'),
  (tests.id('memA2'), tests.id('messA'), tests.id('A2'), 'member',  'active', now() - interval '40 days'),
  (tests.id('memB1'), tests.id('messB'), tests.id('B1'), 'manager', 'active', now() - interval '40 days'),
  (tests.id('memB2'), tests.id('messB'), tests.id('B2'), 'member',  'active', now() - interval '40 days');
insert into public.mess_members (id, mess_id, user_id, role, status) values
  (tests.id('memP'), tests.id('messA'), tests.id('P'), 'member', 'pending');

insert into public.ledger_entries (id, mess_id, user_id, entry_type, amount, description) values
  (tests.id('ledA1'), tests.id('messA'), tests.id('A1'), 'deposit', 500, 'test'),
  (tests.id('ledA2'), tests.id('messA'), tests.id('A2'), 'deposit', 1000, 'test'),
  (tests.id('ledB1'), tests.id('messB'), tests.id('B1'), 'deposit', 500, 'test'),
  (tests.id('ledB2'), tests.id('messB'), tests.id('B2'), 'deposit', 1000, 'test');
insert into public.deposit_requests (id, mess_id, user_id, amount, method, trx_id) values
  (tests.id('depA2'), tests.id('messA'), tests.id('A2'), 700, 'bkash', 'TESTAAAA11'),
  (tests.id('depB2'), tests.id('messB'), tests.id('B2'), 700, 'bkash', 'TESTBBBB22');
insert into public.menus (id, mess_id, menu_date, slot, items) values
  (tests.id('menuA'), tests.id('messA'), private.dhaka_today() + 1, 'dinner', 'ভাত, ডাল'),
  (tests.id('menuB'), tests.id('messB'), private.dhaka_today() + 1, 'dinner', 'ভাত, মাছ');
insert into public.meal_orders (mess_id, menu_id, user_id) values
  (tests.id('messA'), tests.id('menuA'), tests.id('A2')),
  (tests.id('messB'), tests.id('menuB'), tests.id('B2'));
insert into public.expenses (mess_id, amount, description, added_by) values
  (tests.id('messA'), 500, 'bazar A', tests.id('A1')),
  (tests.id('messB'), 600, 'bazar B', tests.id('B1'));
insert into public.bills (id, mess_id, bill_type, period_month, total_amount) values
  (tests.id('billA'), tests.id('messA'), 'wifi', private.month_start(private.dhaka_today()), 1000),
  (tests.id('billB'), tests.id('messB'), 'wifi', private.month_start(private.dhaka_today()), 1000);
insert into public.notices (mess_id, title, body, created_by) values
  (tests.id('messA'), 'Notice A', 'only for A', tests.id('A1')),
  (tests.id('messB'), 'Notice B', 'only for B', tests.id('B1'));
insert into public.complaints (id, mess_id, created_by, category, title) values
  (tests.id('compA'), tests.id('messA'), tests.id('A2'), 'wifi', 'Complaint A'),
  (tests.id('compB'), tests.id('messB'), tests.id('B2'), 'water', 'Complaint B');
insert into public.polls (id, mess_id, question, created_by) values
  (tests.id('pollA'), tests.id('messA'), 'Poll A?', tests.id('A1')),
  (tests.id('pollB'), tests.id('messB'), 'Poll B?', tests.id('B1'));
insert into public.poll_options (poll_id, label) values
  (tests.id('pollA'), 'yes'), (tests.id('pollB'), 'yes');
insert into public.chores (mess_id, chore_type, title, assigned_to, due_date) values
  (tests.id('messA'), 'bazar', 'Bazar A', tests.id('A2'), private.dhaka_today()),
  (tests.id('messB'), 'bazar', 'Bazar B', tests.id('B2'), private.dhaka_today());
insert into public.mood_checkins (user_id, mood, note) values
  (tests.id('A2'), 'sad', 'private feeling A2'),
  (tests.id('B2'), 'okay', 'private feeling B2');
insert into public.budget_entries (user_id, entry_type, category, amount) values
  (tests.id('A2'), 'expense', 'food', 120);
insert into public.care_alerts (id, user_id, mess_id, alert_type, message) values
  (tests.id('alertA2'), tests.id('A2'), tests.id('messA'), 'sos', 'help');
insert into public.care_alert_recipients (alert_id, user_id) values (tests.id('alertA2'), tests.id('A1'));
insert into storage.objects (bucket_id, name, owner)
select 'deposit-proofs', tests.id('messA') || '/' || tests.id('A2') || '/proof.webp', tests.id('A2')
 where tests.local_storage();

-- ------------------------------------------------- member of mess A (A2) --
select tests.login('A2');

do $$
declare
  t text;
  n integer;
begin
  foreach t in array array['mess_settings', 'mess_rooms', 'mess_members', 'menus', 'meal_orders', 'ledger_entries',
                           'deposit_requests', 'expenses', 'bills', 'bill_shares', 'monthly_closings', 'member_statements',
                           'notices', 'complaints', 'complaint_updates', 'chores', 'polls', 'audit_logs', 'notifications'] loop
    execute format('select count(*) from public.%I where mess_id = %L', t, tests.id('messB')) into n;
    perform tests.check(n = 0, 'member of A cannot read mess B rows in ' || t);
  end loop;
end;
$$;

select tests.check((select count(*) from public.messes where id = tests.id('messB')) = 0, 'A2 cannot see mess B');
select tests.check((select count(*) from public.messes where id = tests.id('messA')) = 1, 'A2 sees own mess');
select tests.check((select count(*) from public.notices where mess_id = tests.id('messA')) = 1, 'A2 sees mess A notices');
select tests.check((select count(*) from public.ledger_entries where user_id = tests.id('A2')) = 1, 'A2 sees own ledger');
select tests.check((select count(*) from public.ledger_entries where user_id = tests.id('A1')) = 0, 'A2 cannot see messmate ledger');
select tests.check((select count(*) from public.deposit_requests where user_id = tests.id('A2')) = 1, 'A2 sees own deposit request');
select tests.check((select count(*) from public.profiles where id = tests.id('A1')) = 1, 'A2 sees messmate profile');
select tests.check((select count(*) from public.profiles where id = tests.id('B1')) = 0, 'A2 cannot see mess B profile');
select tests.check((select count(*) from public.profiles where id = tests.id('P')) = 0, 'A2 cannot see pending applicant profile');
select tests.check((select count(*) from public.mess_members where user_id = tests.id('P')) = 0, 'A2 cannot see pending requests');
select tests.check((select count(*) from public.mood_checkins) = 1, 'A2 sees only own mood');
select tests.check((select count(*) from public.poll_options where poll_id = tests.id('pollB')) = 0, 'A2 cannot see mess B poll options');
select tests.check(not tests.local_storage() or (select count(*) from storage.objects where bucket_id = 'deposit-proofs') = 1,
                   'A2 sees own deposit proof');

select tests.throws(format($q$insert into public.ledger_entries (mess_id, user_id, entry_type, amount) values (%L, %L, 'deposit', 100000)$q$,
                           tests.id('messA'), tests.id('A2')), 'row-level security', 'member cannot write own ledger');
update public.ledger_entries set amount = 999999 where user_id = tests.id('A2');
delete from public.ledger_entries where user_id = tests.id('A2');
select tests.check((select sum(amount) from public.ledger_entries where user_id = tests.id('A2')) = 1000,
                   'member update/delete on ledger changes nothing');
select tests.throws(format('select public.review_deposit(%L, true)', tests.id('depA2')), 'not_manager', 'member cannot approve own deposit');
select tests.throws(format('select public.review_deposit(%L, true)', tests.id('depB2')), 'not_manager', 'member cannot approve other mess deposit');
select tests.throws(format('select public.set_meal_order(%L, true)', tests.id('menuB')), 'not_member', 'member cannot order in mess B');
select tests.throws(format($q$insert into public.notices (mess_id, title, body) values (%L, 'hack', 'x')$q$, tests.id('messA')),
                    'row-level security', 'member cannot post notice');
select tests.throws(format($q$insert into public.expenses (mess_id, amount) values (%L, 100)$q$, tests.id('messA')),
                    'row-level security', 'member cannot add expense');
select tests.throws(format($q$insert into public.complaints (mess_id, created_by, category, title) values (%L, %L, 'wifi', 'cross')$q$,
                           tests.id('messB'), tests.id('A2')), 'row-level security', 'member cannot file complaint in mess B');
select tests.throws(format('select public.close_month(%L, %L)', tests.id('messA'), private.month_start(private.dhaka_today()) - 31),
                    'not_manager', 'member cannot close month');
select tests.throws('select public.get_manager_dashboard()', 'not_manager', 'member cannot open manager dashboard');
select tests.throws('select public.get_platform_stats()', 'not_super_admin', 'member cannot open platform stats');
select tests.throws(format($q$update public.profiles set platform_role = 'super_admin' where id = %L$q$, tests.id('A2')),
                    'forbidden_role_change', 'member cannot make self super admin');
select tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('receipts', %L)$q$, tests.id('messA') || '/r.webp'),
                    'row-level security', 'member cannot upload mess receipts');
select tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('deposit-proofs', %L)$q$,
                           tests.id('messB') || '/' || tests.id('A2') || '/x.webp'),
                    'row-level security', 'member cannot upload into another mess folder');
select tests.check((select count(*) from public.care_alerts) = 1, 'alert owner sees own alert');

-- ------------------------------------------------ manager of mess A (A1) --
select tests.login('A1');
select tests.check((select count(*) from public.ledger_entries where mess_id = tests.id('messA')) = 2, 'manager sees all mess A ledger');
select tests.check((select count(*) from public.ledger_entries where mess_id = tests.id('messB')) = 0, 'manager A cannot see mess B ledger');
select tests.check((select count(*) from public.mess_members where user_id = tests.id('P') and status = 'pending') = 1, 'manager sees pending request');
select tests.check((select count(*) from public.profiles where id = tests.id('P')) = 1, 'manager sees applicant profile');
select tests.check((select count(*) from public.mood_checkins) = 0, 'manager cannot read members'' mood');
select tests.check((select count(*) from public.budget_entries) = 0, 'manager cannot read members'' budget');
select tests.check((select count(*) from public.audit_logs where mess_id = tests.id('messA')) > 0, 'manager reads own audit log');
select tests.check((select count(*) from public.audit_logs where mess_id = tests.id('messB')) = 0, 'manager A cannot read mess B audit log');
select tests.check((select count(*) from public.care_alerts where id = tests.id('alertA2')) = 1, 'care recipient sees the alert');
select tests.check(not tests.local_storage() or (select count(*) from storage.objects where bucket_id = 'deposit-proofs') = 1,
                   'manager sees member deposit proof');
update public.menus set items = 'hacked' where id = tests.id('menuB');
delete from public.notices where mess_id = tests.id('messB');
select tests.throws(format($q$insert into public.notices (mess_id, title, body) values (%L, 'cross', 'x')$q$, tests.id('messB')),
                    'row-level security', 'manager A cannot post notice in mess B');
select tests.throws(format('select public.review_deposit(%L, true)', tests.id('depB2')), 'not_manager', 'manager A cannot approve mess B deposit');
select tests.throws(format('select public.post_bill(%L)', tests.id('billB')), 'not_manager', 'manager A cannot post mess B bill');
select tests.throws(format($q$select public.manager_ledger_entry(%L, 'adjustment', 100, 'cross mess')$q$, tests.id('B2')),
                    'not_member', 'manager A cannot adjust mess B member');
select tests.throws(format('select public.set_meal_order(%L, true, 0, %L)', tests.id('menuA'), tests.id('B2')),
                    'not_member', 'manager A cannot order for mess B member');
select tests.throws(format($q$select public.update_member(%L, 'manager')$q$, tests.id('memB2')), 'not_manager', 'manager A cannot change mess B member');
select tests.throws(format('select public.regenerate_invite_code(%L)', tests.id('messB')), 'not_manager', 'manager A cannot reset mess B invite');
select tests.throws(format('select public.close_month(%L, %L)', tests.id('messB'), private.month_start(private.dhaka_today()) - 31),
                    'not_manager', 'manager A cannot close mess B month');
select tests.throws('select public.get_platform_stats()', 'not_super_admin', 'manager is not platform admin');

-- ------------------------------------------------------ manager of mess B --
select tests.login('B1');
select tests.check((select items from public.menus where id = tests.id('menuB')) = 'ভাত, মাছ', 'mess B menu untouched by manager A');
select tests.check((select count(*) from public.notices where mess_id = tests.id('messB')) = 1, 'mess B notice untouched by manager A');
select tests.check((select count(*) from public.care_alerts) = 0, 'other mess cannot see care alert');
select tests.check((select count(*) from storage.objects where bucket_id = 'deposit-proofs') = 0, 'other mess cannot see deposit proof');

-- --------------------------------------------------- pending applicant (P) --
select tests.login('P');
select tests.check((select count(*) from public.messes) = 0, 'pending user cannot read mess');
select tests.check((select count(*) from public.menus) = 0, 'pending user cannot read menus');
select tests.check((select count(*) from public.notices) = 0, 'pending user cannot read notices');
select tests.check((select count(*) from public.mess_members) = 1, 'pending user sees only own request');
select tests.check((public.get_member_dashboard() ->> 'has_mess')::boolean = false, 'pending dashboard says no mess yet');
select tests.throws(format('select public.set_meal_order(%L, true)', tests.id('menuA')), 'not_member', 'pending user cannot order');
select tests.throws($q$select public.submit_deposit(500, 'cash')$q$, 'not_in_mess', 'pending user cannot submit deposit');

-- ---------------------------------------------------------- outsider (X) --
select tests.login('X');
select tests.check((select count(*) from public.profiles) = 1, 'outsider sees only own profile');
select tests.check((select count(*) from public.messes) = 0, 'outsider sees no mess');
select tests.check((select count(*) from public.ledger_entries) = 0, 'outsider sees no ledger');
select tests.check((select count(*) from public.areas) > 0, 'signed-in user reads areas');
select tests.throws($q$select public.request_join('ZZZZZZZZ')$q$, 'invalid_invite', 'unknown invite code rejected');

-- ----------------------------------------------------------- anonymous --
select tests.login_anon();
select tests.check((select count(*) from public.areas) > 0, 'visitor reads areas');
select tests.check((select count(*) from public.emergency_places) > 0, 'visitor reads emergency numbers');
select tests.throws('select count(*) from public.profiles', 'permission denied', 'visitor cannot read profiles');
select tests.throws('select count(*) from public.messes', 'permission denied', 'visitor cannot read messes');
select tests.throws('select count(*) from public.ledger_entries', 'permission denied', 'visitor cannot read ledger');
select tests.throws('select public.get_member_dashboard()', 'permission denied', 'visitor cannot call member RPCs');

-- --------------------------------------------------------- super admin (S) --
select tests.login('S');
select tests.check((select count(*) from public.messes where id in (tests.id('messA'), tests.id('messB'))) = 2, 'admin sees all messes');
select tests.check((select count(*) from public.ledger_entries where mess_id = tests.id('messA')) = 0, 'admin cannot read mess money');
select tests.check((select count(*) from public.mood_checkins) = 0, 'admin cannot read mood data');
select tests.check((public.get_platform_stats() ->> 'messes')::int >= 2, 'admin reads platform stats');

-- ----------------------------------------------------- structural checks --
select tests.logout();
select tests.check((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) = 0,
                   'every public table has RLS enabled');
select tests.check((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname in ('public', 'private') and p.prosecdef
                      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')) = 0,
                   'every SECURITY DEFINER function pins search_path');
select tests.check(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon has no SELECT grant on profiles');
select tests.check(not has_table_privilege('authenticated', 'public.ledger_entries', 'truncate'), 'nobody can TRUNCATE the ledger');

-- ------------------------------------------------------------- clean up ----
select private.purge_data(
  array[tests.id('messA'), tests.id('messB')],
  array[tests.id('A1'), tests.id('A2'), tests.id('B1'), tests.id('B2'), tests.id('P'), tests.id('X'), tests.id('S')]);
do $$
begin
  if tests.local_storage() then
    delete from storage.objects where name like tests.id('messA') || '/%';
  end if;
end;
$$;
select set_config('tests.result', 'RLS isolation: ' || current_setting('tests.passed') || ' checks passed', false);
drop schema tests cascade;
select current_setting('tests.result') as result;
