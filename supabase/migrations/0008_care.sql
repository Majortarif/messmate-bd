-- =============================================================================
-- MessMate BD · 0008 · Care — for bachelors living alone, away from family
--
--   Sick & Safety : sick mode, SOS, "reached home" check-in
--   Mon & Poribar : daily mood check-in, call-home log, festival meetups
--   Taka survival : dhar / loan tracker, tuition & part-time board
--   Ghorer khabar : easy budget recipes (tiffin providers live in services)
--   Self-care     : medicine / water / sleep reminders, water log
--
-- Privacy: mood, health, reminders, loans and check-ins are visible ONLY to
-- their owner (not to managers, not to super admins).
-- =============================================================================

create table public.mood_checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  checkin_date  date not null default private.dhaka_today(),
  mood          public.mood_level not null,
  note          text check (char_length(note) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, checkin_date)
);

create trigger mood_checkins_updated_at before update on public.mood_checkins
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sick mode + SOS
-- -----------------------------------------------------------------------------
create table public.care_alerts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  mess_id          uuid references public.messes (id) on delete set null,
  alert_type       public.care_alert_type not null,
  message          text check (char_length(message) <= 500),
  needs            text[] not null default '{}'
                   check (needs <@ array['light_food', 'medicine', 'doctor', 'company', 'ride', 'call_me']::text[]),
  lat              numeric(9,6),
  lng              numeric(9,6),
  location_text    text check (char_length(location_text) <= 200),
  status           public.care_alert_status not null default 'active',
  acknowledged_by  uuid references public.profiles (id) on delete set null,
  acknowledged_at  timestamptz,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index care_alerts_user_idx on public.care_alerts (user_id, created_at desc);

create table public.care_alert_recipients (
  alert_id      uuid not null references public.care_alerts (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  notified_at   timestamptz not null default now(),
  responded_at  timestamptz,
  response      text check (response in ('on_my_way', 'called', 'acknowledged')),
  primary key (alert_id, user_id)
);
create index care_alert_recipients_user_idx on public.care_alert_recipients (user_id, notified_at desc);

create trigger care_alerts_updated_at before update on public.care_alerts
  for each row execute function private.set_updated_at();

-- RLS helpers (security definer → no policy recursion between the two tables)
create or replace function private.owns_care_alert(p_alert uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.care_alerts a where a.id = p_alert and a.user_id = auth.uid())
$$;

create or replace function private.is_care_recipient(p_alert uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.care_alert_recipients r where r.alert_id = p_alert and r.user_id = auth.uid())
$$;

-- Raise a sick / SOS alert. Messmates and linked contacts get an in-app alert;
-- outside contacts are returned so the app can open WhatsApp / SMS for them.
create or replace function public.raise_care_alert(
  p_type          public.care_alert_type,
  p_message       text default null,
  p_needs         text[] default '{}',
  p_lat           numeric default null,
  p_lng           numeric default null,
  p_location_text text default null,
  p_notify_mess   boolean default true
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_mess     uuid := private.current_mess_id();
  v_id       uuid;
  v_name     text := private.display_name(v_uid);
  v_count    integer;
  v_external jsonb;
  v_title    text;
  v_body     text;
begin
  perform private.check_rate_limit('care:' || v_uid, 6, interval '1 hour');
  if exists (select 1 from public.care_alerts
             where user_id = v_uid and alert_type = p_type and status <> 'resolved'
               and created_at > now() - interval '12 hours') then
    raise exception 'alert_already_active';
  end if;

  insert into public.care_alerts (user_id, mess_id, alert_type, message, needs, lat, lng, location_text)
  values (v_uid, v_mess, p_type, left(nullif(trim(p_message), ''), 500), coalesce(p_needs, '{}'),
          round(p_lat, 6), round(p_lng, 6), left(nullif(trim(p_location_text), ''), 200))
  returning id into v_id;

  insert into public.care_alert_recipients (alert_id, user_id)
  select distinct v_id, x.user_id
    from (select ec.contact_user_id as user_id
            from public.emergency_contacts ec
           where ec.user_id = v_uid and ec.contact_user_id is not null
             and (case when p_type = 'sos' then ec.notify_on_sos else ec.notify_on_sick end)
          union
          select mm.user_id
            from public.mess_members mm
           where p_notify_mess and v_mess is not null
             and mm.mess_id = v_mess and mm.status = 'active' and mm.user_id <> v_uid) x
   where x.user_id is not null;
  get diagnostics v_count = row_count;

  if p_type = 'sos' then
    v_title := 'জরুরি সাহায্য দরকার: ' || v_name;
    v_body := coalesce(nullif(trim(p_message), ''), v_name || ' SOS পাঠিয়েছেন। এখনই খোঁজ নিন।')
              || coalesce(' · অবস্থান: ' || nullif(trim(p_location_text), ''), '');
  else
    v_title := v_name || ' অসুস্থ, সাহায্য চাইছেন';
    v_body := coalesce(nullif(trim(p_message), ''), 'একটু খোঁজ নিন।')
              || case when 'light_food' = any (p_needs) then ' · হালকা খাবার দরকার' else '' end
              || case when 'medicine' = any (p_needs) then ' · ওষুধ দরকার' else '' end
              || case when 'doctor' = any (p_needs) then ' · ডাক্তার দেখানো দরকার' else '' end;
  end if;

  insert into public.notifications (user_id, mess_id, type, title, body, link, data)
  select r.user_id, v_mess, 'care_' || p_type::text, left(v_title, 140), left(v_body, 500), '/care/alerts/' || v_id,
         jsonb_build_object('alert_id', v_id, 'lat', p_lat, 'lng', p_lng)
    from public.care_alert_recipients r where r.alert_id = v_id;

  select coalesce(jsonb_agg(jsonb_build_object('name', ec.name, 'phone', ec.phone, 'relation', ec.relation)
                            order by ec.is_primary desc, ec.name), '[]'::jsonb)
    into v_external
    from public.emergency_contacts ec
   where ec.user_id = v_uid and ec.contact_user_id is null
     and (case when p_type = 'sos' then ec.notify_on_sos else ec.notify_on_sick end);

  return jsonb_build_object('alert_id', v_id, 'notified_in_app', v_count, 'external_contacts', v_external);
end;
$$;

create or replace function public.respond_care_alert(p_alert_id uuid, p_response text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_alert public.care_alerts%rowtype;
begin
  if p_response not in ('on_my_way', 'called', 'acknowledged') then
    raise exception 'invalid_response';
  end if;
  select * into v_alert from public.care_alerts where id = p_alert_id for update;
  if not found or not private.is_care_recipient(p_alert_id) then
    raise exception 'not_found';
  end if;
  if v_alert.status = 'resolved' then
    raise exception 'alert_resolved';
  end if;

  update public.care_alert_recipients
     set responded_at = now(), response = p_response
   where alert_id = p_alert_id and user_id = v_uid;

  if v_alert.status = 'active' then
    update public.care_alerts
       set status = 'acknowledged', acknowledged_by = v_uid, acknowledged_at = now()
     where id = p_alert_id;
  end if;

  perform private.notify(v_alert.user_id, v_alert.mess_id, 'care_response',
    case p_response when 'on_my_way' then private.display_name(v_uid) || ' আসছেন'
                    when 'called' then private.display_name(v_uid) || ' ফোন করবেন'
                    else private.display_name(v_uid) || ' আপনার বার্তা দেখেছেন' end,
    'আপনি একা নন।', '/care', jsonb_build_object('alert_id', p_alert_id));
end;
$$;

create or replace function public.resolve_care_alert(p_alert_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_alert public.care_alerts%rowtype;
begin
  select * into v_alert from public.care_alerts where id = p_alert_id and user_id = v_uid for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_alert.status = 'resolved' then
    return;
  end if;
  update public.care_alerts set status = 'resolved', resolved_at = now() where id = p_alert_id;

  insert into public.notifications (user_id, mess_id, type, title, body, link, data)
  select r.user_id, v_alert.mess_id, 'care_resolved', private.display_name(v_uid) || ' এখন ঠিক আছেন',
         'খোঁজ নেওয়ার জন্য ধন্যবাদ।', '/care', jsonb_build_object('alert_id', p_alert_id)
    from public.care_alert_recipients r where r.alert_id = p_alert_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- "Reached home" check-in (overdue → alert contacts, handled by pg_cron)
-- -----------------------------------------------------------------------------
create table public.safety_checkins (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  label                text not null check (char_length(label) between 2 and 100),
  expected_by          timestamptz not null,
  status               public.checkin_status not null default 'pending',
  arrived_at           timestamptz,
  overdue_notified_at  timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index safety_checkins_due_idx on public.safety_checkins (status, expected_by);
create index safety_checkins_user_idx on public.safety_checkins (user_id, created_at desc);

create or replace function private.guard_safety_checkin()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_system_call() or private.is_internal() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.status := 'pending';
    new.arrived_at := null;
    new.overdue_notified_at := null;
    if new.expected_by < now() + interval '5 minutes' or new.expected_by > now() + interval '24 hours' then
      raise exception 'invalid_expected_time';
    end if;
    -- one running check-in at a time
    perform private.set_internal(true);
    update public.safety_checkins set status = 'cancelled'
     where user_id = new.user_id and status in ('pending', 'overdue');
    perform private.set_internal(false);
    return new;
  end if;

  new.user_id := old.user_id;
  new.overdue_notified_at := old.overdue_notified_at;
  if old.status in ('arrived', 'cancelled') then
    raise exception 'checkin_finished';
  end if;
  if new.status not in ('pending', 'arrived', 'cancelled') and new.status <> old.status then
    new.status := old.status;
  end if;
  if new.expected_by is distinct from old.expected_by
     and (new.expected_by < now() or new.expected_by > now() + interval '24 hours') then
    raise exception 'invalid_expected_time';
  end if;
  if new.status = 'arrived' then
    new.arrived_at := now();
  end if;
  return new;
end;
$$;

-- When someone who was flagged overdue arrives, tell the people who were worried.
create or replace function private.after_safety_checkin()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status = 'arrived' and old.status <> 'arrived' and old.overdue_notified_at is not null then
    insert into public.notifications (user_id, type, title, body, link)
    select ec.contact_user_id, 'checkin_arrived', private.display_name(new.user_id) || ' নিরাপদে পৌঁছেছেন',
           new.label, '/care'
      from public.emergency_contacts ec
     where ec.user_id = new.user_id and ec.contact_user_id is not null and ec.notify_on_checkin;
  end if;
  return null;
end;
$$;

create trigger safety_checkins_guard before insert or update on public.safety_checkins
  for each row execute function private.guard_safety_checkin();
create trigger safety_checkins_after after update of status on public.safety_checkins
  for each row execute function private.after_safety_checkin();
create trigger safety_checkins_updated_at before update on public.safety_checkins
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Self-care reminders, water log, call-home log
-- -----------------------------------------------------------------------------
create table public.reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  reminder_type  public.reminder_type not null,
  title          text not null check (char_length(title) between 1 and 80),
  note           text check (char_length(note) <= 200),
  remind_at      time not null,
  days_of_week   smallint[] not null default '{0,1,2,3,4,5,6}'
                 check (days_of_week <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality(days_of_week) > 0),
  is_active      boolean not null default true,
  last_sent_on   date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index reminders_active_idx on public.reminders (is_active, remind_at);
create index reminders_user_idx on public.reminders (user_id);

create or replace function private.guard_reminder()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_system_call() then
    return new;
  end if;
  new.user_id := auth.uid();
  if tg_op = 'INSERT' and (select count(*) from public.reminders where user_id = new.user_id) >= 20 then
    raise exception 'too_many_reminders';
  end if;
  return new;
end;
$$;

create trigger reminders_guard before insert or update on public.reminders
  for each row execute function private.guard_reminder();
create trigger reminders_updated_at before update on public.reminders
  for each row execute function private.set_updated_at();

create table public.water_logs (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  log_date    date not null default private.dhaka_today(),
  glasses     smallint not null default 0 check (glasses between 0 and 30),
  goal        smallint not null default 8 check (goal between 1 and 30),
  updated_at  timestamptz not null default now(),
  primary key (user_id, log_date)
);

create table public.family_call_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  called_at   timestamptz not null default now(),
  person      text check (char_length(person) <= 60),
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now()
);
create index family_call_logs_user_idx on public.family_call_logs (user_id, called_at desc);

-- -----------------------------------------------------------------------------
-- Dhar / loan tracker (personal record only; never shared with the other person)
-- -----------------------------------------------------------------------------
create table public.loans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  direction           public.loan_direction not null,
  counterparty_name   text not null check (char_length(counterparty_name) between 1 and 80),
  counterparty_phone  text check (counterparty_phone ~ '^\+?[0-9]{10,14}$'),
  amount              numeric(10,2) not null check (amount > 0 and amount <= 10000000),
  repaid_amount       numeric(10,2) not null default 0 check (repaid_amount >= 0),
  due_date            date,
  note                text check (char_length(note) <= 300),
  status              public.loan_status not null default 'open',
  settled_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint loan_repaid_not_more check (repaid_amount <= amount)
);
create index loans_user_idx on public.loans (user_id, status);

create table public.loan_payments (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references public.loans (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0),
  paid_on     date not null default private.dhaka_today(),
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now()
);
create index loan_payments_loan_idx on public.loan_payments (loan_id);

create or replace function private.guard_loan()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (private.is_system_call() or private.is_internal()) then
    new.user_id := coalesce(old.user_id, auth.uid());
    if tg_op = 'INSERT' then
      new.repaid_amount := 0;
    else
      -- repayments are driven by loan_payments
      new.repaid_amount := old.repaid_amount;
    end if;
  end if;
  if new.amount < new.repaid_amount then
    raise exception 'amount_below_repaid';
  end if;
  new.status := case when new.repaid_amount >= new.amount then 'settled'::public.loan_status else 'open'::public.loan_status end;
  new.settled_at := case when new.status = 'settled' then coalesce(old.settled_at, now()) end;
  return new;
end;
$$;

create trigger loans_guard before insert or update on public.loans
  for each row execute function private.guard_loan();
create trigger loans_updated_at before update on public.loans
  for each row execute function private.set_updated_at();

create or replace function private.guard_loan_payment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
begin
  select * into v_loan from public.loans where id = new.loan_id for update;
  new.user_id := v_loan.user_id;
  if v_loan.repaid_amount + new.amount > v_loan.amount then
    raise exception 'payment_exceeds_loan';
  end if;
  return new;
end;
$$;

create or replace function private.sync_loan_repaid()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_loan uuid := coalesce(new.loan_id, old.loan_id);
begin
  perform private.set_internal(true);
  update public.loans
     set repaid_amount = (select coalesce(sum(p.amount), 0) from public.loan_payments p where p.loan_id = v_loan)
   where id = v_loan;
  perform private.set_internal(false);
  return null;
end;
$$;

create trigger loan_payments_guard before insert on public.loan_payments
  for each row execute function private.guard_loan_payment();
create trigger loan_payments_sync after insert or delete on public.loan_payments
  for each row execute function private.sync_loan_repaid();

-- -----------------------------------------------------------------------------
-- Ghorer khabar: easy, cheap recipes (rice cooker / kettle friendly)
-- -----------------------------------------------------------------------------
create table public.recipes (
  id                uuid primary key default gen_random_uuid(),
  title_bn          text not null check (char_length(title_bn) between 2 and 100),
  title_en          text check (char_length(title_en) <= 100),
  description       text check (char_length(description) <= 500),
  ingredients       text not null check (char_length(ingredients) between 3 and 2000),
  steps             text not null check (char_length(steps) between 3 and 4000),
  equipment         public.cook_equipment not null default 'stove',
  cook_minutes      smallint check (cook_minutes between 1 and 300),
  servings          smallint not null default 1 check (servings between 1 and 20),
  cost_estimate     numeric(8,2) check (cost_estimate >= 0),
  is_budget         boolean not null default true,
  is_sick_friendly  boolean not null default false,
  created_by        uuid references public.profiles (id) on delete set null,
  status            public.moderation_status not null default 'pending',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index recipes_browse_idx on public.recipes (status, equipment);

-- -----------------------------------------------------------------------------
-- Community events (Eid / Puja / iftar in Dhaka when you can't go home)
-- -----------------------------------------------------------------------------
create table public.community_events (
  id             uuid primary key default gen_random_uuid(),
  organizer_id   uuid not null references public.profiles (id) on delete cascade,
  event_type     public.event_type not null,
  title          text not null check (char_length(title) between 3 and 120),
  description    text check (char_length(description) <= 2000),
  area_id        smallint references public.areas (id) on delete set null,
  venue          text check (char_length(venue) <= 200),
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  max_people     smallint check (max_people between 2 and 1000),
  contact_phone  text check (contact_phone ~ '^\+?[0-9]{10,14}$'),
  rsvp_count     integer not null default 0,
  status         public.moderation_status not null default 'approved',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint event_time_order check (ends_at is null or ends_at > starts_at)
);
create index community_events_upcoming_idx on public.community_events (status, starts_at);

create table public.event_rsvps (
  event_id    uuid not null references public.community_events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Tuition / part-time board
-- -----------------------------------------------------------------------------
create table public.job_posts (
  id             uuid primary key default gen_random_uuid(),
  posted_by      uuid not null references public.profiles (id) on delete cascade,
  job_type       public.job_type not null,
  title          text not null check (char_length(title) between 3 and 120),
  description    text not null check (char_length(description) between 10 and 2000),
  area_id        smallint references public.areas (id) on delete set null,
  salary_text    text check (char_length(salary_text) <= 80),
  schedule_text  text check (char_length(schedule_text) <= 120),
  contact_phone  text not null check (contact_phone ~ '^\+?[0-9]{10,14}$'),
  status         public.job_status not null default 'open',
  expires_at     date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index job_posts_browse_idx on public.job_posts (status, job_type, area_id, created_at desc);

-- Shared guard for recipes / events / job posts: owner fields are fixed,
-- moderation states belong to super admins.
create or replace function private.guard_community_post()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner_col text := case tg_table_name when 'recipes' then 'created_by'
                                         when 'community_events' then 'organizer_id'
                                         else 'posted_by' end;
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
begin
  if private.is_system_call() or private.is_internal() or private.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform private.check_rate_limit(tg_table_name || ':' || auth.uid(), 5, interval '1 day');
    v_new := v_new || jsonb_build_object(v_owner_col, auth.uid());
    if tg_table_name = 'recipes' then
      v_new := v_new || jsonb_build_object('status', 'pending');
    elsif tg_table_name = 'community_events' then
      v_new := v_new || jsonb_build_object('status', 'approved', 'rsvp_count', 0);
    elsif (v_new ->> 'status') = 'removed' then
      v_new := v_new || jsonb_build_object('status', 'open');
    end if;
  else
    v_old := to_jsonb(old);
    v_new := v_new || jsonb_build_object(v_owner_col, v_old -> v_owner_col);
    if tg_table_name = 'job_posts' then
      if (v_old ->> 'status') = 'removed' then
        raise exception 'post_removed_by_moderator';
      end if;
      if (v_new ->> 'status') = 'removed' then
        v_new := v_new || jsonb_build_object('status', v_old -> 'status');
      end if;
    else
      if (v_new ->> 'status') is distinct from (v_old ->> 'status') and (v_new ->> 'status') <> 'archived' then
        v_new := v_new || jsonb_build_object('status', v_old -> 'status');
      end if;
      if tg_table_name = 'community_events' then
        v_new := v_new || jsonb_build_object('rsvp_count', v_old -> 'rsvp_count');
      end if;
    end if;
  end if;

  new := jsonb_populate_record(new, v_new);
  return new;
end;
$$;

create trigger recipes_guard before insert or update on public.recipes
  for each row execute function private.guard_community_post();
create trigger community_events_guard before insert or update on public.community_events
  for each row execute function private.guard_community_post();
create trigger job_posts_guard before insert or update on public.job_posts
  for each row execute function private.guard_community_post();
create trigger recipes_updated_at before update on public.recipes
  for each row execute function private.set_updated_at();
create trigger community_events_updated_at before update on public.community_events
  for each row execute function private.set_updated_at();
create trigger job_posts_updated_at before update on public.job_posts
  for each row execute function private.set_updated_at();

create or replace function private.guard_event_rsvp()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event public.community_events%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_event from public.community_events where id = new.event_id for update;
    if v_event.status <> 'approved' or v_event.starts_at < now() then
      raise exception 'event_not_open';
    end if;
    if v_event.max_people is not null and v_event.rsvp_count >= v_event.max_people then
      raise exception 'event_full';
    end if;
    if not private.is_system_call() then
      new.user_id := auth.uid();
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.sync_rsvp_count()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event uuid := coalesce(new.event_id, old.event_id);
begin
  perform private.set_internal(true);
  update public.community_events
     set rsvp_count = (select count(*) from public.event_rsvps r where r.event_id = v_event)
   where id = v_event;
  perform private.set_internal(false);
  return null;
end;
$$;

create trigger event_rsvps_guard before insert or delete on public.event_rsvps
  for each row execute function private.guard_event_rsvp();
create trigger event_rsvps_sync after insert or delete on public.event_rsvps
  for each row execute function private.sync_rsvp_count();
