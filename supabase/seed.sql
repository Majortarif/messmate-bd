-- =============================================================================
-- MessMate BD · seed.sql — DEMO DATA (optional)
--
-- Two messes, 17 demo users, 60 days of meals / bazar / deposits / bills with
-- the earlier months already closed, plus housing, services, marketplace,
-- events, jobs and Care data, so every screen looks alive on first run.
--
--   Demo password for every demo account:  Demo@12345
--   Manager (auto meal rate, Mirpur)  : rafi@messmate.demo
--   Member                            : tanvir@messmate.demo
--   Manager (fixed price, Dhanmondi)  : nusrat@messmate.demo
--   Landlord                          : karim@messmate.demo
--
-- Phone numbers use the unassigned 010 prefix so no real person is called.
-- Run AFTER setup.sql. Remove everything later with supabase/remove_demo.sql.
-- =============================================================================

-- 1) Demo auth users (the on_auth_user_created trigger creates their profiles)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email,
       extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', v.full_name, 'terms_version', '2026-10', 'account_type', v.account_type),
       now() - interval '80 days', now(), '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001', 'rafi@messmate.demo',    'রাফি আহমেদ',      'user'),
  ('d0000000-0000-4000-8000-000000000002', 'tanvir@messmate.demo',  'তানভীর হাসান',     'user'),
  ('d0000000-0000-4000-8000-000000000003', 'sabbir@messmate.demo',  'সাব্বির রহমান',     'user'),
  ('d0000000-0000-4000-8000-000000000004', 'nayeem@messmate.demo',  'নাঈম ইসলাম',      'user'),
  ('d0000000-0000-4000-8000-000000000005', 'arif@messmate.demo',    'আরিফ হোসেন',      'user'),
  ('d0000000-0000-4000-8000-000000000006', 'mahin@messmate.demo',   'মাহিন চৌধুরী',     'user'),
  ('d0000000-0000-4000-8000-000000000007', 'rakib@messmate.demo',   'রাকিব উদ্দিন',     'user'),
  ('d0000000-0000-4000-8000-000000000008', 'shuvo@messmate.demo',   'শুভ দাস',         'user'),
  ('d0000000-0000-4000-8000-000000000009', 'imran@messmate.demo',   'ইমরান কবির',      'user'),
  ('d0000000-0000-4000-8000-000000000010', 'nusrat@messmate.demo',  'নুসরাত জাহান',     'user'),
  ('d0000000-0000-4000-8000-000000000011', 'farzana@messmate.demo', 'ফারজানা আক্তার',    'user'),
  ('d0000000-0000-4000-8000-000000000012', 'tasnim@messmate.demo',  'তাসনিম আরা',      'user'),
  ('d0000000-0000-4000-8000-000000000013', 'mim@messmate.demo',     'মিম সুলতানা',      'user'),
  ('d0000000-0000-4000-8000-000000000014', 'karim@messmate.demo',   'করিম উদ্দিন',      'landlord'),
  ('d0000000-0000-4000-8000-000000000015', 'jamal@messmate.demo',   'জামাল মিয়া',       'service_provider'),
  ('d0000000-0000-4000-8000-000000000016', 'hasib@messmate.demo',   'হাসিব রহমান',      'user'),
  ('d0000000-0000-4000-8000-000000000017', 'fahim@messmate.demo',   'ফাহিম মাহমুদ',     'user')
) as v(id, email, full_name, account_type);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%@messmate.demo';

-- 2) Profile details
update public.profiles p
   set phone = v.phone, gender = v.gender::public.gender_type, occupation = v.occupation::public.occupation_type,
       institution = v.institution, home_district = v.district, blood_group = v.blood
from (values
  ('d0000000-0000-4000-8000-000000000001', '01000000101', 'male',   'job_holder', 'সফটওয়্যার কোম্পানি, বনানী', 'রাজশাহী',  'B+'),
  ('d0000000-0000-4000-8000-000000000002', '01000000102', 'male',   'student',    'ঢাকা বিশ্ববিদ্যালয়',          'বরিশাল',   'O+'),
  ('d0000000-0000-4000-8000-000000000003', '01000000103', 'male',   'job_holder', 'বেসরকারি ব্যাংক, মতিঝিল',    'কুমিল্লা',  'A+'),
  ('d0000000-0000-4000-8000-000000000004', '01000000104', 'male',   'student',    'মিরপুর বাংলা কলেজ',          'রংপুর',    'O-'),
  ('d0000000-0000-4000-8000-000000000005', '01000000105', 'male',   'job_holder', 'গার্মেন্টস বায়িং হাউস',        'নোয়াখালী', 'B-'),
  ('d0000000-0000-4000-8000-000000000006', '01000000106', 'male',   'student',    'প্রকৌশল বিশ্ববিদ্যালয়',       'সিলেট',    'AB+'),
  ('d0000000-0000-4000-8000-000000000007', '01000000107', 'male',   'job_holder', 'ই-কমার্স ডেলিভারি হাব',      'ময়মনসিংহ', 'A-'),
  ('d0000000-0000-4000-8000-000000000008', '01000000108', 'male',   'student',    'জগন্নাথ বিশ্ববিদ্যালয়',        'খুলনা',    'O+'),
  ('d0000000-0000-4000-8000-000000000009', '01000000109', 'male',   'job_holder', 'কল সেন্টার',                'বগুড়া',    'B+'),
  ('d0000000-0000-4000-8000-000000000010', '01000000110', 'female', 'job_holder', 'এনজিও, ধানমন্ডি',            'যশোর',    'A+'),
  ('d0000000-0000-4000-8000-000000000011', '01000000111', 'female', 'student',    'ইডেন মহিলা কলেজ',           'ফরিদপুর',  'O+'),
  ('d0000000-0000-4000-8000-000000000012', '01000000112', 'female', 'student',    'ঢাকা মেডিকেল কলেজ',          'চট্টগ্রাম',  'B+'),
  ('d0000000-0000-4000-8000-000000000013', '01000000113', 'female', 'job_holder', 'বায়িং হাউস, গুলশান',          'টাঙ্গাইল',  'AB-'),
  ('d0000000-0000-4000-8000-000000000014', '01000000114', 'male',   'business',   null,                         'ঢাকা',     null),
  ('d0000000-0000-4000-8000-000000000015', '01000000115', 'male',   'business',   null,                         'ঢাকা',     null),
  ('d0000000-0000-4000-8000-000000000016', '01000000116', 'male',   'job_holder', 'টেলিকম কোম্পানি',             'পাবনা',    'O+'),
  ('d0000000-0000-4000-8000-000000000017', '01000000117', 'male',   'student',    'তিতুমীর কলেজ',               'দিনাজপুর',  'A+')
) as v(id, phone, gender, occupation, institution, district, blood)
where p.id = v.id::uuid;

-- 3) Messes, members and history
do $$
declare
  v_today  date := private.dhaka_today();
  v_start  date := private.dhaka_today() - 59;
  m1 uuid := 'e0000000-0000-4000-8000-000000000001';
  m2 uuid := 'e0000000-0000-4000-8000-000000000002';
  rafi uuid := 'd0000000-0000-4000-8000-000000000001';
  tanvir uuid := 'd0000000-0000-4000-8000-000000000002';
  sabbir uuid := 'd0000000-0000-4000-8000-000000000003';
  nayeem uuid := 'd0000000-0000-4000-8000-000000000004';
  arif uuid := 'd0000000-0000-4000-8000-000000000005';
  mahin uuid := 'd0000000-0000-4000-8000-000000000006';
  rakib uuid := 'd0000000-0000-4000-8000-000000000007';
  shuvo uuid := 'd0000000-0000-4000-8000-000000000008';
  imran uuid := 'd0000000-0000-4000-8000-000000000009';
  nusrat uuid := 'd0000000-0000-4000-8000-000000000010';
  farzana uuid := 'd0000000-0000-4000-8000-000000000011';
  tasnim uuid := 'd0000000-0000-4000-8000-000000000012';
  mim uuid := 'd0000000-0000-4000-8000-000000000013';
  karim uuid := 'd0000000-0000-4000-8000-000000000014';
  jamal uuid := 'd0000000-0000-4000-8000-000000000015';
  hasib uuid := 'd0000000-0000-4000-8000-000000000016';
  fahim uuid := 'd0000000-0000-4000-8000-000000000017';
  r1 uuid := 'f1000000-0000-4000-8000-000000000001';
  r2 uuid := 'f1000000-0000-4000-8000-000000000002';
  r3 uuid := 'f1000000-0000-4000-8000-000000000003';
  r4 uuid := 'f1000000-0000-4000-8000-000000000004';
  r5 uuid := 'f1000000-0000-4000-8000-000000000005';
  r6 uuid := 'f1000000-0000-4000-8000-000000000006';
  v_m1_members uuid[];
  v_m2_members uuid[];
  v_breakfast text[] := array['খিচুড়ি, ডিম ভাজি', 'রুটি, ডাল, সবজি', 'পরোটা, ডিম, চা', 'ভাত, আলু ভর্তা, ডাল'];
  v_lunch     text[] := array['ভাত, মুরগির মাংস, ডাল', 'ভাত, রুই মাছ, সবজি, ডাল', 'ভাত, ডিম ভুনা, ডাল', 'ভাত, পাঙ্গাশ মাছ, শাক', 'পোলাও, মুরগির রোস্ট, সালাদ'];
  v_dinner    text[] := array['ভাত, ডাল, আলু ভাজি, ডিম', 'ভাত, মুরগি, ডাল', 'ভাত, মাছ, সবজি', 'খিচুড়ি, গরুর মাংস'];
  v_month  date;
  v_day    date;
  v_ts     timestamptz;
  v_entry  uuid;
  v_req    uuid;
  v_amount numeric;
  v_method public.payment_method;
  v_bill   uuid;
  v_poll   uuid;
  v_opt    uuid[];
  v_event  uuid;
  i        integer;
  u        uuid;
  r        record;
begin
  -- ---------------------------------------------------------------- messes --
  insert into public.messes (id, name, description, area_id, address, building_name, gender_policy, invite_code, created_by, created_at)
  values
    (m1, 'নীড় ব্যাচেলর মেস', 'ছাত্র ও চাকরিজীবী ভাইদের জন্য পরিচ্ছন্ন মেস। তিন বেলা ঘরোয়া রান্না, ২৪ ঘণ্টা পানি ও ওয়াইফাই।',
     (select id from public.areas where slug = 'mirpur'), 'রোড ৫, সেকশন ১০, মিরপুর, ঢাকা', 'নীড় ভবন', 'male', 'NEER2026', rafi, now() - interval '76 days'),
    (m2, 'সবুজ ছায়া ছাত্রী নিবাস', 'মেয়েদের নিরাপদ হোস্টেল। ফিক্সড মিল রেট, অগ্রিম ওয়ালেট সিস্টেম।',
     (select id from public.areas where slug = 'dhanmondi'), 'রোড ১৫, ধানমন্ডি, ঢাকা', 'সবুজ ছায়া', 'female', 'SHOBUJ26', nusrat, now() - interval '40 days');

  insert into public.mess_settings (mess_id, meal_rate_mode) values (m1, 'auto');
  insert into public.mess_settings (mess_id, meal_rate_mode, breakfast_price, lunch_price, dinner_price,
                                    credit_limit, low_balance_threshold, max_guests_per_meal)
  values (m2, 'fixed', 40, 80, 80, 200, 500, 2);

  insert into public.mess_rooms (id, mess_id, building, flat, room_label, room_type, capacity, monthly_rent) values
    (r1, m1, 'নীড় ভবন', '৩-এ', '৩০১', 'double', 2, 7000),
    (r2, m1, 'নীড় ভবন', '৩-এ', '৩০২', 'double', 2, 6400),
    (r3, m1, 'নীড় ভবন', '৪-এ', '৪০১', 'shared', 3, 9000),
    (r4, m1, 'নীড় ভবন', '৪-এ', '৪০২', 'single', 1, 4500),
    (r5, m2, 'সবুজ ছায়া', '২-বি', 'রুম ১', 'double', 2, 7000),
    (r6, m2, 'সবুজ ছায়া', '২-বি', 'রুম ২', 'double', 2, 7000);

  insert into public.mess_members (mess_id, user_id, role, status, room_id, joined_at, decided_by, decided_at) values
    (m1, rafi,   'manager', 'active', r1, now() - interval '75 days', rafi, now() - interval '75 days'),
    (m1, tanvir, 'member',  'active', r1, now() - interval '74 days', rafi, now() - interval '74 days'),
    (m1, sabbir, 'member',  'active', r2, now() - interval '74 days', rafi, now() - interval '74 days'),
    (m1, nayeem, 'member',  'active', r2, now() - interval '73 days', rafi, now() - interval '73 days'),
    (m1, arif,   'member',  'active', r3, now() - interval '72 days', rafi, now() - interval '72 days'),
    (m1, mahin,  'member',  'active', r3, now() - interval '72 days', rafi, now() - interval '72 days'),
    (m1, rakib,  'member',  'active', r3, now() - interval '70 days', rafi, now() - interval '70 days'),
    (m1, shuvo,  'member',  'active', r4, now() - interval '20 days', rafi, now() - interval '20 days'),
    (m2, nusrat, 'manager', 'active', r5, now() - interval '40 days', nusrat, now() - interval '40 days'),
    (m2, farzana,'member',  'active', r5, now() - interval '38 days', nusrat, now() - interval '38 days'),
    (m2, tasnim, 'member',  'active', r6, now() - interval '38 days', nusrat, now() - interval '38 days'),
    (m2, mim,    'member',  'active', r6, now() - interval '35 days', nusrat, now() - interval '35 days');
  insert into public.mess_members (mess_id, user_id, role, status, request_note, created_at)
  values (m1, imran, 'member', 'pending', 'ভাই, মিরপুর ১০ এ অফিস। একটা সিট দরকার, আগামী মাস থেকে উঠতে চাই।', now() - interval '5 hours');

  v_m1_members := array[rafi, tanvir, sabbir, nayeem, arif, mahin, rakib, shuvo];
  v_m2_members := array[nusrat, farzana, tasnim, mim];

  -- ------------------------------------------------- mess 1: 60 days of meals --
  insert into public.menus (mess_id, menu_date, slot, items, created_by)
  select m1, d::date, s.slot,
         case s.slot when 'breakfast' then v_breakfast[1 + (d::date - v_start) % 4]
                     when 'lunch' then case when extract(dow from d) = 5 then v_lunch[5] else v_lunch[1 + (d::date - v_start) % 4] end
                     else v_dinner[1 + (d::date - v_start) % 4] end,
         rafi
    from generate_series(v_start, v_today + 1, interval '1 day') d
   cross join unnest(array['breakfast', 'lunch', 'dinner']::public.meal_slot[]) as s(slot);

  insert into public.meal_orders (mess_id, menu_id, user_id, status, guest_count, ordered_by, created_at)
  select m1, mn.id, mm.user_id, 'ordered',
         case when abs(hashtext(mn.id::text || mm.user_id::text || 'guest')::bigint) % 100 < 3 then 1 else 0 end,
         mm.user_id, mn.cutoff_at - interval '3 hours'
    from public.menus mn
    join public.mess_members mm on mm.mess_id = m1 and mm.status = 'active'
   where mn.mess_id = m1
     and mn.menu_date >= (mm.joined_at at time zone 'Asia/Dhaka')::date
     and (mn.menu_date <= v_today or mm.user_id <> rafi)
     and abs(hashtext(mn.id::text || mm.user_id::text)::bigint) % 100
         < case mn.slot when 'breakfast' then 65 when 'lunch' then 72 else 88 end;

  -- bazar every second day (every third trip paid from a member's own pocket)
  insert into public.expenses (mess_id, category, amount, expense_date, description, paid_from, paid_by, added_by, created_at)
  select m1, 'bazar', 1400 + (abs(hashtext(d::text)::bigint) % 120) * 10, d::date,
         (array['চাল ২৫ কেজি, ডাল, তেল', 'মুরগি ৪ কেজি, সবজি, পেঁয়াজ', 'রুই মাছ, আলু, ডিম ৩০টি',
                'সবজি, ডিম, মসলা', 'গরুর মাংস ২ কেজি, সবজি'])[1 + (d::date - v_start) % 5],
         case when (d::date - v_start) % 6 = 0 then 'member' else 'mess_fund' end::public.expense_payer,
         case when (d::date - v_start) % 6 = 0 then v_m1_members[1 + ((d::date - v_start) / 6) % 7] end,
         rafi, d::date + time '19:00'
    from generate_series(v_start, v_today, interval '2 days') d;

  insert into public.expenses (mess_id, category, amount, expense_date, description, paid_from, added_by)
  select m1, 'cooking_gas', 1450, d::date, 'এলপিজি সিলিন্ডার ১২ কেজি', 'mess_fund', rafi
    from generate_series(v_start, v_today, interval '1 day') d where extract(day from d) in (5, 20);
  insert into public.expenses (mess_id, category, amount, expense_date, description, paid_from, added_by)
  select m1, 'cleaning', 400, d::date, 'ঝাড়ু, ফিনাইল, ডিটারজেন্ট', 'mess_fund', rafi
    from generate_series(v_start, v_today, interval '1 day') d where extract(day from d) = 1;
  insert into public.expenses (mess_id, category, amount, expense_date, description, paid_from, added_by) values
    (m1, 'utensils', 850, v_start + 3, 'নতুন হাঁড়ি ও স্টিলের প্লেট', 'mess_fund', rafi),
    (m1, 'repair', 650, v_today - 33, 'রান্নাঘরের পানির কল মেরামত', 'mess_fund', rafi);

  -- deposits: everyone tops up in the first days of each month
  for v_month in select generate_series(private.month_start(v_start), private.month_start(v_today), interval '1 month')::date loop
    for i in 1..array_length(v_m1_members, 1) loop
      u := v_m1_members[i];
      v_day := greatest(v_month + (abs(hashtext(u::text || v_month::text)::bigint) % 5)::int,
                        (select (joined_at at time zone 'Asia/Dhaka')::date from public.mess_members where user_id = u and mess_id = m1),
                        v_start);
      continue when v_day > v_today or private.month_start(v_day) <> v_month;
      continue when u = rakib and v_month = private.month_start(v_today);  -- one member behind on payment
      v_amount := 6500 + (abs(hashtext(u::text || 'amt' || v_month::text)::bigint) % 7) * 500;
      v_method := (array['bkash', 'nagad', 'rocket', 'cash']::public.payment_method[])[1 + (abs(hashtext(u::text || v_month::text || 'm')::bigint) % 4)::int];
      v_ts := private.dhaka_ts(v_day, '10:30');
      v_entry := gen_random_uuid();
      v_req := gen_random_uuid();
      insert into public.ledger_entries (id, mess_id, user_id, entry_type, amount, description, period_month, ref_table, ref_id, created_by, created_at)
      values (v_entry, m1, u, 'deposit', v_amount, 'জমা · ' || v_method::text, v_month, 'deposit_requests', v_req, rafi, v_ts + interval '2 hours');
      insert into public.deposit_requests (id, mess_id, user_id, amount, method, trx_id, sender_number, paid_at,
                                           status, reviewed_by, reviewed_at, ledger_entry_id, created_at)
      values (v_req, m1, u, v_amount, v_method,
              case when v_method <> 'cash' then upper(substr(md5(v_req::text), 1, 10)) end,
              case when v_method <> 'cash' then '010000001' || lpad(i::text, 2, '0') end,
              v_ts, 'approved', rafi, v_ts + interval '2 hours', v_entry, v_ts);
    end loop;
  end loop;

  -- bills: wifi, bua, electricity (equal) + rent (by room) for every month
  for v_month in select generate_series(private.month_start(v_start), private.month_start(v_today), interval '1 month')::date loop
    insert into public.bills (id, mess_id, bill_type, period_month, total_amount, split_mode, due_date, description, created_by)
    values (gen_random_uuid(), m1, 'wifi', v_month, 1500, 'equal', v_month + 9, '৪০ Mbps ব্রডব্যান্ড', rafi) returning id into v_bill;
    perform public.post_bill(v_bill);
    insert into public.bills (id, mess_id, bill_type, period_month, total_amount, split_mode, due_date, description, created_by)
    values (gen_random_uuid(), m1, 'bua', v_month, 6400, 'equal', v_month + 9, 'রান্না ও পরিষ্কারের বুয়া (২ জন)', rafi) returning id into v_bill;
    perform public.post_bill(v_bill);
    insert into public.bills (id, mess_id, bill_type, period_month, total_amount, split_mode, due_date, description, created_by)
    values (gen_random_uuid(), m1, 'rent', v_month, 0, 'by_room', v_month + 4, 'রুম অনুযায়ী মাসিক ভাড়া', rafi) returning id into v_bill;
    perform public.post_bill(v_bill);
    insert into public.bills (id, mess_id, bill_type, period_month, total_amount, split_mode, due_date, description, created_by)
    values (gen_random_uuid(), m1, 'electricity', v_month, 2800 + (abs(hashtext(v_month::text)::bigint) % 9) * 100,
            'equal', v_month + 14, 'প্রিপেইড মিটার রিচার্জ', rafi) returning id into v_bill;
    if v_month < private.month_start(v_today) then
      perform public.post_bill(v_bill);   -- this month's electricity stays a draft
    end if;
  end loop;

  -- close every finished month (meal rate, shared expenses, statements)
  for v_month in select generate_series(private.month_start(v_start), private.month_start(v_today) - interval '1 month', interval '1 month')::date loop
    perform public.close_month(m1, v_month);
  end loop;

  -- two deposits waiting for the manager's approval
  insert into public.deposit_requests (mess_id, user_id, amount, method, trx_id, sender_number, paid_at, note, created_at) values
    (m1, tanvir, 2000, 'bkash', 'BK7X2M9Q4P', '01000000102', now() - interval '3 hours', 'টিউশনির টাকা পেয়ে পাঠালাম', now() - interval '3 hours'),
    (m1, nayeem, 1500, 'nagad', 'NG73KD92LQ', '01000000104', now() - interval '50 minutes', null, now() - interval '50 minutes');

  -- --------------------------------------------- mess 1: community activity --
  insert into public.notices (mess_id, title, body, priority, is_pinned, created_by, created_at) values
    (m1, 'মেসের নিয়মাবলি',
     E'১. রাত ১১টার পর মেইন গেট বন্ধ থাকবে।\n২. অতিথি এলে আগের দিন ম্যানেজারকে জানাবেন।\n৩. প্রতি মাসের ৫ তারিখের মধ্যে অগ্রিম টাকা জমা দিন।\n৪. রান্নাঘর ও বাথরুম পরিষ্কার রাখুন।\n৫. রাত ১২টার পর জোরে গান/ফোনে কথা নয়।',
     'high', true, rafi, now() - interval '70 days'),
    (m1, 'এই মাসের ওয়াইফাই ও বুয়ার বিল যোগ হয়েছে', 'বিলিং পেজে নিজের ভাগ দেখে নিন। বিদ্যুৎ বিল মাসের মাঝামাঝি যোগ হবে।',
     'normal', false, rafi, now() - interval '6 days'),
    (m1, 'আগামীকাল সকাল ১০টা–২টা পানি বন্ধ থাকবে', 'ওয়াসার লাইনের কাজ চলবে। আজ রাতেই বালতিতে পানি ভরে রাখুন।',
     'urgent', false, rafi, now() - interval '1 day');

  insert into public.complaints (mess_id, created_by, category, title, description, status, priority, created_at) values
    (m1, tanvir, 'wifi', 'রাতে ওয়াইফাই খুব স্লো', 'রাত ১০টার পর ভিডিও ক্লাস করা যায় না, বারবার কেটে যায়।', 'in_progress', 'high', now() - interval '4 days'),
    (m1, sabbir, 'water', 'তিন তলার বাথরুমে পানির চাপ কম', 'সকালে গোসলের সময় পানি একদম আসে না।', 'resolved', 'normal', now() - interval '12 days'),
    (m1, nayeem, 'gas', 'সকালে গ্যাসের চাপ কম', 'নাস্তা বানাতে দেরি হচ্ছে, সিলিন্ডার আগে বদলানো যায় কিনা দেখবেন।', 'open', 'normal', now() - interval '1 day');
  insert into public.complaint_updates (complaint_id, mess_id, author_id, message, status_change, created_at)
  select c.id, m1, rafi, 'ISP কে জানানো হয়েছে, এই সপ্তাহে নতুন রাউটার লাগানো হবে।', 'in_progress', now() - interval '3 days'
    from public.complaints c where c.mess_id = m1 and c.category = 'wifi';

  -- bazar duty roster: next 14 days, round robin
  for i in 0..13 loop
    insert into public.chores (mess_id, chore_type, title, assigned_to, due_date, status, created_by)
    values (m1, 'bazar', 'সকালের বাজার', v_m1_members[1 + (i % 8)], v_today + i, 'pending', rafi);
  end loop;
  for i in 1..3 loop
    insert into public.chores (mess_id, chore_type, title, assigned_to, due_date, status, done_at, created_by)
    values (m1, 'bazar', 'সকালের বাজার', v_m1_members[1 + ((i + 4) % 8)], v_today - i, 'done', now() - (i || ' days')::interval, rafi);
  end loop;
  insert into public.chores (mess_id, chore_type, title, assigned_to, due_date, created_by) values
    (m1, 'cleaning', 'রান্নাঘর ও ডাইনিং পরিষ্কার', mahin, v_today + 2, rafi),
    (m1, 'water_filter', 'পানির ফিল্টার পরিষ্কার', rakib, v_today + 5, rafi);

  -- polls
  insert into public.polls (id, mess_id, question, description, created_by, closes_at, created_at)
  values (gen_random_uuid(), m1, 'শুক্রবারের স্পেশাল মেনু কী হবে?', 'সবচেয়ে বেশি ভোট পাওয়া মেনু রান্না হবে।', rafi,
          now() + interval '2 days', now() - interval '1 day')
  returning id into v_poll;
  with ins as (
    insert into public.poll_options (poll_id, label, sort_order)
    values (v_poll, 'কাচ্চি বিরিয়ানি', 1), (v_poll, 'পোলাও ও মুরগির রোস্ট', 2), (v_poll, 'খিচুড়ি ও গরুর মাংস', 3)
    returning id, sort_order)
  select array_agg(id order by sort_order) into v_opt from ins;
  insert into public.poll_votes (poll_id, option_id, user_id) values
    (v_poll, v_opt[1], tanvir), (v_poll, v_opt[1], sabbir), (v_poll, v_opt[1], mahin),
    (v_poll, v_opt[2], arif), (v_poll, v_opt[3], rakib), (v_poll, v_opt[3], nayeem);

  insert into public.polls (id, mess_id, question, created_by, is_anonymous, closes_at, created_at)
  values (gen_random_uuid(), m1, 'ওয়াইফাই ৮০ Mbps এ আপগ্রেড করবো? (মাথাপিছু ৳৫০ বাড়বে)', tanvir, true,
          now() + interval '4 days', now() - interval '6 hours')
  returning id into v_poll;
  with ins as (
    insert into public.poll_options (poll_id, label, sort_order) values (v_poll, 'হ্যাঁ, করা হোক', 1), (v_poll, 'না, এখন দরকার নেই', 2)
    returning id, sort_order)
  select array_agg(id order by sort_order) into v_opt from ins;
  insert into public.poll_votes (poll_id, option_id, user_id) values
    (v_poll, v_opt[1], tanvir), (v_poll, v_opt[1], mahin), (v_poll, v_opt[1], shuvo), (v_poll, v_opt[2], arif);

  -- ----------------------------------------- mess 2: fixed price, prepaid ----
  for i in 1..array_length(v_m2_members, 1) loop
    u := v_m2_members[i];
    v_day := v_today - 34;
    v_ts := private.dhaka_ts(v_day, '11:00');
    v_entry := gen_random_uuid();
    v_req := gen_random_uuid();
    insert into public.ledger_entries (id, mess_id, user_id, entry_type, amount, description, period_month, ref_table, ref_id, created_by, created_at)
    values (v_entry, m2, u, 'deposit', 3000, 'জমা · bkash', private.month_start(v_day), 'deposit_requests', v_req, nusrat, v_ts);
    insert into public.deposit_requests (id, mess_id, user_id, amount, method, trx_id, sender_number, paid_at,
                                         status, reviewed_by, reviewed_at, ledger_entry_id, created_at)
    values (v_req, m2, u, 3000, 'bkash', upper(substr(md5(v_req::text), 1, 10)), '010000002' || lpad(i::text, 2, '0'),
            v_ts, 'approved', nusrat, v_ts, v_entry, v_ts);

    v_day := v_today - 8;
    v_ts := private.dhaka_ts(v_day, '11:00');
    v_entry := gen_random_uuid();
    v_req := gen_random_uuid();
    insert into public.ledger_entries (id, mess_id, user_id, entry_type, amount, description, period_month, ref_table, ref_id, created_by, created_at)
    values (v_entry, m2, u, 'deposit', 1500, 'জমা · nagad', private.month_start(v_day), 'deposit_requests', v_req, nusrat, v_ts);
    insert into public.deposit_requests (id, mess_id, user_id, amount, method, trx_id, sender_number, paid_at,
                                         status, reviewed_by, reviewed_at, ledger_entry_id, created_at)
    values (v_req, m2, u, 1500, 'nagad', upper(substr(md5(v_req::text), 1, 10)), '010000002' || lpad(i::text, 2, '0'),
            v_ts, 'approved', nusrat, v_ts, v_entry, v_ts);
  end loop;

  insert into public.menus (mess_id, menu_date, slot, items, created_by)
  select m2, d::date, s.slot,
         case s.slot when 'breakfast' then v_breakfast[1 + (d::date - v_start) % 4]
                     when 'lunch' then v_lunch[1 + (d::date - v_start) % 5]
                     else v_dinner[1 + (d::date - v_start) % 4] end,
         nusrat
    from generate_series(v_today - 13, v_today + 1, interval '1 day') d
   cross join unnest(array['breakfast', 'lunch', 'dinner']::public.meal_slot[]) as s(slot);

  -- orders go through the real RPC (as the manager) so every charge hits the ledger
  perform set_config('request.jwt.claims', jsonb_build_object('sub', nusrat, 'role', 'authenticated')::text, true);
  for r in select mn.id, mn.menu_date, mm.user_id
             from public.menus mn
             join public.mess_members mm on mm.mess_id = m2 and mm.status = 'active'
            where mn.mess_id = m2 and mn.menu_date <= v_today
              and abs(hashtext(mn.id::text || mm.user_id::text)::bigint) % 100
                  < case mn.slot when 'breakfast' then 70 when 'lunch' then 60 else 85 end
            order by mn.menu_date, mn.slot loop
    perform public.set_meal_order(r.id, true, 0, r.user_id);
  end loop;
  -- one cancellation (refund) to show both sides of the ledger
  select o.menu_id, o.user_id into r from public.meal_orders o join public.menus mn on mn.id = o.menu_id
   where o.mess_id = m2 and mn.menu_date = v_today - 2 and o.status = 'ordered' limit 1;
  if found then
    perform public.set_meal_order(r.menu_id, false, 0, r.user_id);
  end if;
  perform set_config('request.jwt.claims', '', true);

  insert into public.notices (mess_id, title, body, priority, is_pinned, created_by, created_at) values
    (m2, 'গেট বন্ধের সময় রাত ১০:৩০', 'নিরাপত্তার জন্য রাত ১০:৩০ এর পর গেট বন্ধ থাকবে। দেরি হলে আগে জানাবেন।', 'high', true, nusrat, now() - interval '30 days');

  -- --------------------------------------------------- housing & community --
  insert into public.listings (owner_id, listing_type, title, description, area_id, address_line, lat, lng, rent, advance_deposit,
                               available_from, gender_pref, tenant_pref, seats_available, facilities, contact_name, contact_phone,
                               status, created_at)
  select karim, v.t::public.listing_type, v.title, v.descr, (select id from public.areas where slug = v.area), v.addr, v.lat, v.lng,
         v.rent, v.adv, v_today + v.avail, v.g::public.gender_pref, v.tp::public.tenant_pref, v.seats, v.fac, 'করিম উদ্দিন',
         '01000000114', v.st::public.moderation_status, now() - (v.age || ' days')::interval
    from (values
      ('seat', 'মিরপুর ১০ এ ছেলেদের মেসে ২টি সিট খালি', 'তিন বেলা খাবারের ব্যবস্থা, পরিষ্কার বাথরুম, মেট্রো স্টেশন ৫ মিনিট।',
       'mirpur', 'সেকশন ১০, মিরপুর', 23.806900, 90.368700, 3500, 3500, 3, 'male', 'any', 2,
       array['wifi', 'gas', 'meal_system', 'water_filter'], 'approved', 3),
      ('room', 'উত্তরা সেক্টর ১০ এ সিঙ্গেল রুম (অ্যাটাচড বাথ)', 'চাকরিজীবীদের জন্য শান্ত পরিবেশ, লিফট ও জেনারেটর আছে।',
       'uttara', 'সেক্টর ১০, উত্তরা', 23.870600, 90.383700, 7500, 15000, 10, 'male', 'job_holder', 1,
       array['wifi', 'lift', 'generator', 'attached_bath', 'security'], 'approved', 5),
      ('flat', 'উত্তর বাড্ডায় ২ রুমের ছোট ফ্ল্যাট, ব্যাচেলর চলবে', 'রান্নাঘর, বারান্দা, গ্যাস লাইন। ৪ জন ব্যাচেলর থাকতে পারবেন।',
       'badda', 'উত্তর বাড্ডা', 23.785800, 90.426600, 14000, 28000, 15, 'any', 'any', 4,
       array['gas', 'kitchen', 'balcony', 'water_filter'], 'approved', 8),
      ('sublet', 'ধানমন্ডি ১৫ এ মেয়েদের জন্য সাবলেট', 'পরিবারের সাথে সাবলেট, মেয়ে শিক্ষার্থী বা চাকরিজীবী।',
       'dhanmondi', 'রোড ১৫, ধানমন্ডি', 23.745400, 90.371000, 6000, 6000, 7, 'female', 'any', 1,
       array['wifi', 'gas', 'security', 'cctv'], 'approved', 2),
      ('seat', 'মোহাম্মদপুর তাজমহল রোডে ছাত্রদের সিট', 'বই পড়ার পরিবেশ, কাছেই বাস স্ট্যান্ড।',
       'mohammadpur', 'তাজমহল রোড, মোহাম্মদপুর', 23.764500, 90.364300, 3000, 3000, 1, 'male', 'student', 3,
       array['wifi', 'meal_system'], 'approved', 1),
      ('room', 'রামপুরা টিভি সেন্টারের কাছে শেয়ার্ড রুম', 'দুজন মিলে থাকার রুম, আইপিএস আছে।',
       'rampura', 'রামপুরা', 23.762900, 90.421400, 4500, 4500, 5, 'male', 'any', 1,
       array['ips', 'gas'], 'pending', 0)
    ) as v(t, title, descr, area, addr, lat, lng, rent, adv, avail, g, tp, seats, fac, st, age);

  insert into public.service_providers (name, category, area_id, phone, description, price_note, is_verified, verified_at,
                                        owner_id, status)
  select v.name, v.cat::public.service_category, (select id from public.areas where slug = v.area), v.phone, v.descr, v.price,
         v.verified, case when v.verified then now() - interval '20 days' end, v.owner, 'approved'
    from (values
      ('রহিমা খালা (রান্না ও ঘর মোছা)', 'bua_cook', 'mirpur', '01000000201', 'দুই বেলা রান্না, সপ্তাহে ৩ দিন ঘর মোছা।', 'মাসে ৳৩,৫০০ থেকে', true, null::uuid),
      ('মায়ের হাতের রান্না টিফিন', 'tiffin', 'mirpur', '01000000202', 'ঘরোয়া রান্না, দুপুর ও রাতে টিফিন বাক্সে পৌঁছে দেওয়া হয়।', 'দুপুর ৳৯০ · রাত ৳৮০', true, null),
      ('ঘরোয়া টিফিন সার্ভিস (ধানমন্ডি)', 'tiffin', 'dhanmondi', '01000000203', 'মেয়েদের হোস্টেলে নিয়মিত টিফিন দেন।', 'মাসিক প্যাকেজ ৳৪,৫০০', false, null),
      ('জামাল ইলেকট্রিক', 'electrician', 'mirpur', '01000000115', 'ফ্যান, সুইচ, ওয়্যারিং, আইপিএস লাইন। ইমার্জেন্সিতে রাতেও আসেন।', 'ভিজিট ৳৩০০', true, jamal),
      ('বাবুল প্লাম্বিং', 'plumber', 'badda', '01000000205', 'কল, পাইপ লিক, বেসিন ও কমোড মেরামত।', 'ভিজিট ৳২৫০', true, null),
      ('এলপিজি হোম ডেলিভারি', 'gas_cylinder', 'mirpur', '01000000206', '১২ কেজি সিলিন্ডার ১ ঘণ্টার মধ্যে বাসায়।', 'বাজার দর + ডেলিভারি ৳৫০', false, null),
      ('এরিয়া ব্রডব্যান্ড (মিরপুর)', 'internet', 'mirpur', '01000000207', 'মেস প্যাকেজ, ফ্রি সংযোগ।', '২০ Mbps ৳৮০০/মাস', false, null),
      ('ধোপা লন্ড্রি পিকআপ', 'laundry', 'uttara', '01000000208', 'বাসা থেকে কাপড় নিয়ে ২ দিনে ইস্ত্রি করে ফেরত।', 'প্রতি পিস ৳১৫', false, null),
      ('ছোট পিকআপ – বাসা বদল', 'moving_van', 'mohammadpur', '01000000209', 'মেস বা ছোট ফ্ল্যাটের মালামাল, লোডার সহ।', 'ঢাকার ভেতর ৳২,৫০০ থেকে', true, null)
    ) as v(name, cat, area, phone, descr, price, verified, owner);

  insert into public.service_reviews (provider_id, user_id, rating, comment)
  select sp.id, v.uid, v.rating, v.comment
    from (values
      ('bua_cook', rafi, 5::smallint, 'রান্না খুব ভালো, সময়মতো আসেন।'),
      ('bua_cook', arif, 4::smallint, 'মাঝে মাঝে দেরি হয়, কিন্তু রান্না মজার।'),
      ('tiffin', tanvir, 4::smallint, 'মায়ের রান্নার মতো স্বাদ।'),
      ('electrician', sabbir, 5::smallint, 'রাত ১১টায় ডাকলেও এসেছেন।')
    ) as v(cat, uid, rating, comment)
    join public.service_providers sp on sp.category = v.cat::public.service_category
   where sp.area_id = (select id from public.areas where slug = 'mirpur');

  insert into public.market_items (seller_id, title, description, category, condition, price, is_negotiable, area_id, mess_id, contact_phone, status, created_at) values
    (tanvir, 'পড়ার টেবিল ও চেয়ার', 'কাঠের টেবিল, একটা ড্রয়ার আছে। হল ছেড়ে যাচ্ছি তাই বিক্রি।', 'furniture', 'good', 2200, true,
     (select id from public.areas where slug = 'mirpur'), m1, '01000000102', 'available', now() - interval '2 days'),
    (sabbir, 'টেবিল ফ্যান (৬ মাস ব্যবহৃত)', '১৬ ইঞ্চি, তিন স্পিড, কোনো সমস্যা নেই।', 'fan', 'like_new', 1200, false,
     (select id from public.areas where slug = 'mirpur'), m1, '01000000103', 'available', now() - interval '1 day'),
    (farzana, 'IELTS Cambridge 1-18 বই সেট', 'কিছু পাতায় পেন্সিলের দাগ আছে।', 'books', 'good', 900, true,
     (select id from public.areas where slug = 'dhanmondi'), m2, '01000000111', 'available', now() - interval '4 days'),
    (hasib, 'সিঙ্গেল তোশক', 'ফোমের তোশক, ৩ ফুট।', 'bed', 'fair', 800, true,
     (select id from public.areas where slug = 'shyamoli'), null, '01000000116', 'available', now() - interval '6 days'),
    (mahin, 'রাইস কুকার ১.৮ লিটার', 'ভালো চলে, নতুন কিনেছি তাই দিয়ে দিচ্ছি।', 'kitchen', 'good', 1100, false,
     (select id from public.areas where slug = 'mirpur'), m1, '01000000106', 'sold', now() - interval '9 days');

  insert into public.community_events (id, organizer_id, event_type, title, description, area_id, venue, starts_at, ends_at, max_people, contact_phone)
  values (gen_random_uuid(), rafi, 'meetup', 'মিরপুরের ব্যাচেলরদের শুক্রবার বিকেলের আড্ডা ও ফুটবল',
          'বাড়ি থেকে দূরে থাকা ভাইদের সাথে পরিচয়, খেলা আর চা-আড্ডা। সবাই আমন্ত্রিত।',
          (select id from public.areas where slug = 'mirpur'), 'মিরপুর ২ খেলার মাঠের পাশে',
          private.dhaka_ts(v_today + coalesce(nullif((5 - extract(dow from v_today)::int + 7) % 7, 0), 7), '16:00'),
          private.dhaka_ts(v_today + coalesce(nullif((5 - extract(dow from v_today)::int + 7) % 7, 0), 7), '19:00'),
          30, '01000000101')
  returning id into v_event;
  insert into public.event_rsvps (event_id, user_id) values (v_event, tanvir), (v_event, sabbir), (v_event, hasib);
  insert into public.community_events (organizer_id, event_type, title, description, area_id, venue, starts_at, max_people)
  values (farzana, 'study', 'IELTS স্টাডি গ্রুপ (মেয়েদের)', 'প্রতি সপ্তাহে একসাথে স্পিকিং প্র্যাকটিস।',
          (select id from public.areas where slug = 'dhanmondi'), 'ধানমন্ডি লেকের পাশের ক্যাফে',
          private.dhaka_ts(v_today + 5, '17:00'), 12);

  insert into public.job_posts (posted_by, job_type, title, description, area_id, salary_text, schedule_text, contact_phone, expires_at) values
    (karim, 'tuition', 'ক্লাস ৮ এর ছাত্রের জন্য গণিত ও বিজ্ঞান টিউটর', 'ইংরেজি মাধ্যম নয়, বাংলা মাধ্যম। ভালো রেজাল্টধারী শিক্ষার্থী চাই।',
     (select id from public.areas where slug = 'mirpur'), '৳৫,০০০/মাস', 'সপ্তাহে ৩ দিন, সন্ধ্যা', '01000000114', v_today + 20),
    (hasib, 'part_time', 'কফিশপে পার্ট-টাইম (সন্ধ্যার শিফট)', 'সন্ধ্যা ৬টা–রাত ১০টা। ছাত্রদের অগ্রাধিকার।',
     (select id from public.areas where slug = 'banani'), 'ঘণ্টায় ৳১২০', 'সপ্তাহে ৪ দিন', '01000000116', v_today + 14),
    (nusrat, 'tuition', 'ক্লাস ৫ এর বাংলা ও ইংরেজি পড়ানোর জন্য মেয়ে শিক্ষক', 'বাসা ধানমন্ডি ১৫। মেয়ে শিক্ষার্থী চাই।',
     (select id from public.areas where slug = 'dhanmondi'), '৳৪,০০০/মাস', 'সপ্তাহে ৪ দিন, বিকেল', '01000000110', v_today + 10);

  insert into public.roommate_profiles (user_id, gender, occupation, budget_min, budget_max, smoking, sleep_schedule, cleanliness,
                                        food_pref, guests_ok, move_in_date, about, contact_phone, show_phone) values
    (hasib, 'male', 'job_holder', 4000, 6000, false, 'early', 4, 'halal_only', true, v_today + 15,
     'টেলিকম কোম্পানিতে চাকরি করি, সকাল ৮টায় অফিস। পরিষ্কার-পরিচ্ছন্ন থাকতে পছন্দ করি।', '01000000116', true),
    (fahim, 'male', 'student', 3000, 4500, false, 'late', 3, 'any', true, v_today + 7,
     'অনার্স ৩য় বর্ষ, রাত জেগে পড়ি। শান্ত রুমমেট চাই।', '01000000117', false),
    (rafi, 'male', 'job_holder', 4000, 7000, false, 'flexible', 4, 'halal_only', true, null,
     'মেস ম্যানেজার, নতুন সদস্য খুঁজছি।', '01000000101', true),
    (tanvir, 'male', 'student', 3000, 5000, false, 'late', 3, 'any', true, null,
     'ঢাবির ছাত্র, টিউশনি করি।', null, false);
  insert into public.roommate_area_prefs (user_id, area_id)
  select v.uid, a.id from (values (hasib, 'mirpur'), (hasib, 'shyamoli'), (fahim, 'mirpur'), (fahim, 'mohammadpur'),
                                  (rafi, 'mirpur'), (tanvir, 'mirpur'), (tanvir, 'farmgate')) as v(uid, slug)
    join public.areas a on a.slug = v.slug;

  insert into public.rent_records (user_id, title, landlord_name, landlord_phone, property_address, monthly_rent, advance_paid,
                                   security_deposit, rent_due_day, agreement_start, agreement_end, notice_period_days, agreement_notes)
  values (hasib, 'শ্যামলীর সাবলেট রুম', 'মোস্তফা সাহেব', '01000000301', 'রিং রোড, শ্যামলী', 5500, 5500, 0, 5,
          v_today - 200, v_today + 165, 30, 'বিদ্যুৎ বিল আলাদা। ছাড়ার আগে ১ মাসের নোটিশ দিতে হবে।');

  -- ------------------------------------------------- Care (Rafi's own view) --
  insert into public.emergency_contacts (user_id, name, relation, phone, contact_user_id, is_primary) values
    (rafi, 'আম্মা', 'মা', '01000000901', null, true),
    (rafi, 'তানভীর (রুমমেট)', 'রুমমেট', '01000000102', tanvir, false),
    (tanvir, 'রাফি ভাই (ম্যানেজার)', 'মেস ম্যানেজার', '01000000101', rafi, true);

  insert into public.mood_checkins (user_id, checkin_date, mood, note)
  select rafi, v_today - g, (array['good', 'okay', 'tired', 'great', 'good', 'stressed']::public.mood_level[])[g],
         case g when 3 then 'অফিসে অনেক চাপ ছিল' when 6 then 'বাড়ির কথা মনে পড়ছে' end
    from generate_series(1, 6) g;

  insert into public.reminders (user_id, reminder_type, title, remind_at, days_of_week) values
    (rafi, 'medicine', 'গ্যাস্ট্রিকের ওষুধ', '21:30', '{0,1,2,3,4,5,6}'),
    (rafi, 'water', 'এক গ্লাস পানি', '15:00', '{0,1,2,3,4,5,6}'),
    (rafi, 'call_home', 'আম্মাকে ফোন', '21:00', '{5}');
  insert into public.water_logs (user_id, log_date, glasses, goal) values (rafi, v_today, 5, 8);
  insert into public.family_call_logs (user_id, called_at, person, note)
  values (rafi, now() - interval '3 days', 'আম্মা', 'আব্বার শরীর ভালো');

  insert into public.loans (user_id, direction, counterparty_name, amount, due_date, note)
  values (rafi, 'lent', 'সাব্বির', 500, v_today + 7, 'বাসভাড়ার জন্য');
  insert into public.loans (id, user_id, direction, counterparty_name, amount, due_date)
  values (gen_random_uuid(), rafi, 'borrowed', 'আরিফ', 300, v_today + 3) returning id into v_req;
  insert into public.loan_payments (loan_id, user_id, amount, paid_on) values (v_req, rafi, 100, v_today - 1);

  insert into public.monthly_budgets (user_id, period_month, limit_amount, expected_income)
  values (rafi, private.month_start(v_today), 15000, 28000);
  insert into public.budget_entries (user_id, entry_type, category, amount, entry_date, note)
  select rafi, v.t::public.budget_entry_type, v.c::public.budget_category, v.amt,
         greatest(private.month_start(v_today), v_today - v.ago), v.note
    from (values
      ('income', 'salary', 28000, 20, 'মাসের বেতন'),
      ('expense', 'food', 4500, 19, 'মেসে অগ্রিম'),
      ('expense', 'family', 5000, 18, 'বাড়িতে পাঠালাম'),
      ('expense', 'transport', 1200, 10, 'বাস ও রিকশা'),
      ('expense', 'mobile_internet', 500, 9, 'মোবাইল রিচার্জ'),
      ('expense', 'entertainment', 600, 4, 'বন্ধুদের সাথে খাওয়া')
    ) as v(t, c, amt, ago, note);

  insert into public.feedback (user_id, mess_id, type, subject, message)
  values (tanvir, m1, 'feedback', 'দারুণ লাগছে', 'ডার্ক মোডটা চোখে আরাম দেয়। মিল অর্ডারের রিমাইন্ডার রাতে একবার দিলে আরও ভালো হয়।');

  -- history notifications count as read; leave a few fresh ones for the bell
  update public.notifications set read_at = now() where read_at is null and type <> 'notice_urgent';
  perform private.notify(rafi, m1, 'join_request', 'নতুন সদস্যের অনুরোধ', 'ইমরান কবির মেসে যোগ দিতে চায়।', '/manage/members');
  perform private.notify(rafi, m1, 'deposit_submitted', 'নতুন টাকা জমার অনুরোধ',
    'তানভীর হাসান ৳2000.00 জমা দিয়েছেন (bkash · BK7X2M9Q4P)। যাচাই করে অনুমোদন দিন।', '/manage/approvals');
  perform private.notify(rafi, m1, 'deposit_submitted', 'নতুন টাকা জমার অনুরোধ',
    'নাঈম ইসলাম ৳1500.00 জমা দিয়েছেন (nagad · NG73KD92LQ)। যাচাই করে অনুমোদন দিন।', '/manage/approvals');
  perform private.notify(rafi, m1, 'complaint_new', 'নতুন অভিযোগ: সকালে গ্যাসের চাপ কম',
    'নাঈম ইসলাম একটি অভিযোগ জানিয়েছেন।', '/mess/complaints');
end;
$$;
