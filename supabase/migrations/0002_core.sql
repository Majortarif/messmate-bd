-- =============================================================================
-- MessMate BD · 0002 · Core: areas, profiles, messes, membership, platform
-- Multi-tenant model: a mess is the tenant. A user has at most ONE open
-- membership (pending / active / inactive) at a time.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Dhaka areas (reference data is loaded in 0012)
-- -----------------------------------------------------------------------------
create table public.areas (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_bn     text not null check (char_length(name_bn) between 2 and 60),
  name_en     text not null check (char_length(name_en) between 2 and 60),
  lat         numeric(9,6),
  lng         numeric(9,6),
  sort_order  smallint not null default 100
);

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null default '' check (char_length(full_name) <= 80),
  email              text,
  phone              text check (phone ~ '^\+?[0-9]{10,14}$'),
  avatar_url         text check (char_length(avatar_url) <= 500),
  platform_role      public.platform_role not null default 'user',
  gender             public.gender_type,
  occupation         public.occupation_type,
  institution        text check (char_length(institution) <= 120),
  home_district      text check (char_length(home_district) <= 60),
  blood_group        text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  guardian_name      text check (char_length(guardian_name) <= 80),
  guardian_phone     text check (guardian_phone ~ '^\+?[0-9]{10,14}$'),
  bio                text check (char_length(bio) <= 300),
  preferred_locale   text not null default 'bn' check (preferred_locale in ('bn', 'en')),
  terms_accepted_at  timestamptz,
  terms_version      text check (char_length(terms_version) <= 20),
  is_deleted         boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_platform_role_idx on public.profiles (platform_role) where platform_role <> 'user';

-- -----------------------------------------------------------------------------
-- Messes (tenants) + settings + rooms
-- -----------------------------------------------------------------------------
create table public.messes (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 3 and 80),
  description     text check (char_length(description) <= 500),
  area_id         smallint references public.areas (id) on delete set null,
  address         text check (char_length(address) <= 200),
  building_name   text check (char_length(building_name) <= 80),
  gender_policy   public.gender_pref not null default 'any',
  invite_code     text not null unique default private.new_invite_code() check (invite_code ~ '^[A-Z0-9]{8}$'),
  invite_enabled  boolean not null default true,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index messes_area_idx on public.messes (area_id);

create table public.mess_settings (
  mess_id                    uuid primary key references public.messes (id) on delete cascade,
  meal_rate_mode             public.meal_rate_mode not null default 'auto',
  breakfast_price            numeric(10,2) not null default 35 check (breakfast_price >= 0),
  lunch_price                numeric(10,2) not null default 75 check (lunch_price >= 0),
  dinner_price               numeric(10,2) not null default 75 check (dinner_price >= 0),
  -- meal units used for the auto meal rate (breakfast often counts as half a meal)
  breakfast_weight           numeric(3,2) not null default 0.5 check (breakfast_weight between 0 and 2),
  lunch_weight               numeric(3,2) not null default 1 check (lunch_weight between 0 and 2),
  dinner_weight              numeric(3,2) not null default 1 check (dinner_weight between 0 and 2),
  breakfast_cutoff           time not null default '22:00',
  breakfast_cutoff_prev_day  boolean not null default true,
  lunch_cutoff               time not null default '10:00',
  lunch_cutoff_prev_day      boolean not null default false,
  dinner_cutoff              time not null default '17:00',
  dinner_cutoff_prev_day     boolean not null default false,
  guest_meal_allowed         boolean not null default true,
  max_guests_per_meal        smallint not null default 3 check (max_guests_per_meal between 0 and 10),
  credit_limit               numeric(10,2) not null default 0 check (credit_limit >= 0),
  low_balance_threshold      numeric(10,2) not null default 300 check (low_balance_threshold >= 0),
  split_shared_expenses      boolean not null default true,
  auto_close_enabled         boolean not null default true,
  -- previous month auto-closes on this day of the new month (grace days for late bazar slips)
  auto_close_day             smallint not null default 3 check (auto_close_day between 1 and 10),
  updated_at                 timestamptz not null default now()
);

create table public.mess_rooms (
  id            uuid primary key default gen_random_uuid(),
  mess_id       uuid not null references public.messes (id) on delete cascade,
  building      text check (char_length(building) <= 60),
  flat          text check (char_length(flat) <= 30),
  room_label    text not null check (char_length(room_label) between 1 and 30),
  room_type     public.room_type not null default 'shared',
  capacity      smallint not null default 2 check (capacity between 1 and 20),
  monthly_rent  numeric(10,2) not null default 0 check (monthly_rent >= 0),
  notes         text check (char_length(notes) <= 200),
  created_at    timestamptz not null default now(),
  unique nulls not distinct (mess_id, building, flat, room_label)
);
create index mess_rooms_mess_idx on public.mess_rooms (mess_id);

create table public.mess_members (
  id             uuid primary key default gen_random_uuid(),
  mess_id        uuid not null references public.messes (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete restrict,
  role           public.mess_role not null default 'member',
  status         public.member_status not null default 'pending',
  room_id        uuid references public.mess_rooms (id) on delete set null,
  seat_label     text check (char_length(seat_label) <= 20),
  request_note   text check (char_length(request_note) <= 300),
  decided_by     uuid references public.profiles (id) on delete set null,
  decided_at     timestamptz,
  decision_note  text check (char_length(decision_note) <= 300),
  joined_at      timestamptz,
  left_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint mess_members_joined_when_active check (status not in ('active', 'inactive') or joined_at is not null)
);
-- One open membership per user across the whole platform.
create unique index mess_members_one_open_per_user on public.mess_members (user_id)
  where status in ('pending', 'active', 'inactive');
create index mess_members_mess_status_idx on public.mess_members (mess_id, status);
create index mess_members_room_idx on public.mess_members (room_id);

-- -----------------------------------------------------------------------------
-- Platform tables
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  mess_id     uuid references public.messes (id) on delete cascade,
  type        text not null check (char_length(type) <= 40),
  title       text not null check (char_length(title) <= 140),
  body        text check (char_length(body) <= 500),
  link        text check (char_length(link) <= 200),
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  mess_id     uuid,
  actor_id    uuid,
  action      text not null,
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_mess_created_idx on public.audit_logs (mess_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create table public.legal_acceptances (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  document     text not null check (document in ('terms', 'privacy')),
  version      text not null check (char_length(version) <= 20),
  accepted_at  timestamptz not null default now(),
  unique (user_id, document, version)
);

create table public.feedback (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles (id) on delete set null,
  mess_id        uuid references public.messes (id) on delete set null,
  type           public.feedback_type not null default 'feedback',
  subject        text check (char_length(subject) <= 120),
  message        text not null check (char_length(message) between 5 and 2000),
  contact_email  text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  page_url       text check (char_length(page_url) <= 300),
  status         public.feedback_status not null default 'new',
  admin_note     text check (char_length(admin_note) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index feedback_status_idx on public.feedback (status, created_at desc);

-- Fixed-window rate limiter (lives in the private schema: never exposed).
create table private.rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          integer not null
);

-- -----------------------------------------------------------------------------
-- Tenancy helpers (used by RLS policies and RPCs)
-- -----------------------------------------------------------------------------

-- The mess the current user belongs to (active or temporarily inactive).
create or replace function private.current_mess_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select mm.mess_id
  from public.mess_members mm
  where mm.user_id = auth.uid()
    and mm.status in ('active', 'inactive')
  limit 1
$$;

-- The mess the current user manages (active managers only).
create or replace function private.managed_mess_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select mm.mess_id
  from public.mess_members mm
  where mm.user_id = auth.uid()
    and mm.status = 'active'
    and mm.role = 'manager'
  limit 1
$$;

create or replace function private.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.platform_role = 'super_admin' and not p.is_deleted
  )
$$;

create or replace function private.is_active_member(p_mess uuid, p_user uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mess_members mm
    where mm.mess_id = p_mess and mm.user_id = p_user and mm.status = 'active'
  )
$$;

-- True when the current user shares a mess with p_user (used by Care contacts).
create or replace function private.shares_mess(p_user uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mess_members mm
    where mm.user_id = p_user
      and mm.status in ('active', 'inactive')
      and mm.mess_id = private.current_mess_id()
  )
$$;

-- Profile visibility: yourself, your messmates, applicants to the mess you
-- manage, and super admins.
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
             and (mm.status in ('active', 'inactive')
                  or (mm.status = 'pending' and mm.mess_id = private.managed_mess_id()))
         )
      or private.is_super_admin()
$$;

-- Raises 'rate_limited' when p_key was used more than p_max times in p_window.
create or replace function private.check_rate_limit(p_key text, p_max integer, p_window interval)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into private.rate_limits as rl (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when rl.window_start < now() - p_window then 1 else rl.hits + 1 end,
        window_start = case when rl.window_start < now() - p_window then now() else rl.window_start end
  returning rl.hits into v_hits;

  if v_hits > p_max then
    raise exception 'rate_limited' using hint = 'Too many requests. Try again later.';
  end if;
end;
$$;

create or replace function private.require_user()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Notification helpers
-- -----------------------------------------------------------------------------
create or replace function private.notify(
  p_user uuid, p_mess uuid, p_type text, p_title text,
  p_body text default null, p_link text default null, p_data jsonb default '{}'::jsonb
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, mess_id, type, title, body, link, data)
  values (p_user, p_mess, p_type, left(p_title, 140), left(p_body, 500), p_link, coalesce(p_data, '{}'::jsonb));
$$;

create or replace function private.notify_managers(
  p_mess uuid, p_type text, p_title text,
  p_body text default null, p_link text default null, p_data jsonb default '{}'::jsonb
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, mess_id, type, title, body, link, data)
  select mm.user_id, p_mess, p_type, left(p_title, 140), left(p_body, 500), p_link, coalesce(p_data, '{}'::jsonb)
  from public.mess_members mm
  where mm.mess_id = p_mess and mm.role = 'manager' and mm.status = 'active';
$$;

create or replace function private.notify_mess(
  p_mess uuid, p_type text, p_title text,
  p_body text default null, p_link text default null, p_data jsonb default '{}'::jsonb,
  p_exclude uuid default null
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, mess_id, type, title, body, link, data)
  select mm.user_id, p_mess, p_type, left(p_title, 140), left(p_body, 500), p_link, coalesce(p_data, '{}'::jsonb)
  from public.mess_members mm
  where mm.mess_id = p_mess
    and mm.status in ('active', 'inactive')
    and mm.user_id is distinct from p_exclude;
$$;

create or replace function private.display_name(p_user uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(nullif(p.full_name, ''), 'সদস্য') from public.profiles p where p.id = p_user
$$;

-- -----------------------------------------------------------------------------
-- Audit trail (generic row trigger; attached to money/membership tables)
-- -----------------------------------------------------------------------------
create or replace function private.audit_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_row jsonb;
  v_mess uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op = 'UPDATE' and v_new = v_old then
    return null;
  end if;
  v_row := coalesce(v_new, v_old);
  v_mess := case when tg_table_name = 'messes'
                 then private.try_uuid(v_row ->> 'id')
                 else private.try_uuid(v_row ->> 'mess_id') end;

  insert into public.audit_logs (mess_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_mess, auth.uid(), tg_op, tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'mess_id'), v_old, v_new);
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Auth integration: create the profile row when someone signs up
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_terms text := left(nullif(trim(v_meta ->> 'terms_version'), ''), 20);
  v_role  public.platform_role := 'user';
begin
  -- Self-chosen account types; super_admin can never come from metadata.
  if v_meta ->> 'account_type' in ('landlord', 'service_provider') then
    v_role := (v_meta ->> 'account_type')::public.platform_role;
  end if;

  insert into public.profiles (id, full_name, email, phone, avatar_url, platform_role,
                               preferred_locale, terms_accepted_at, terms_version)
  values (
    new.id,
    left(coalesce(nullif(trim(v_meta ->> 'full_name'), ''),
                  nullif(trim(v_meta ->> 'name'), ''),
                  split_part(coalesce(new.email, ''), '@', 1)), 80),
    new.email,
    case when v_meta ->> 'phone' ~ '^\+?[0-9]{10,14}$' then v_meta ->> 'phone' end,
    left(nullif(v_meta ->> 'avatar_url', ''), 500),
    v_role,
    case when v_meta ->> 'locale' = 'en' then 'en' else 'bn' end,
    case when v_terms is not null then now() end,
    v_terms
  )
  on conflict (id) do nothing;

  if v_terms is not null then
    insert into public.legal_acceptances (user_id, document, version)
    values (new.id, 'terms', v_terms), (new.id, 'privacy', v_terms)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Users may edit their own profile, but never their id, email, deletion flag,
-- legal acceptance or (to / from) super_admin role.
create or replace function private.guard_profile_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_system_call() or private.is_internal() then
    return new;
  end if;

  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  new.is_deleted := old.is_deleted;
  new.terms_accepted_at := old.terms_accepted_at;
  new.terms_version := old.terms_version;

  if new.platform_role is distinct from old.platform_role and not private.is_super_admin() then
    if new.platform_role = 'super_admin' or old.platform_role = 'super_admin' then
      raise exception 'forbidden_role_change';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Managers edit their mess details; ownership, activation and invite codes are
-- changed only through RPCs or by super admins.
create or replace function private.guard_mess_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_system_call() or private.is_internal() or private.is_super_admin() then
    return new;
  end if;
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.is_active := old.is_active;
  new.invite_code := old.invite_code;
  return new;
end;
$$;

create trigger messes_guard before update on public.messes
  for each row execute function private.guard_mess_update();
create trigger messes_updated_at before update on public.messes
  for each row execute function private.set_updated_at();
create trigger mess_settings_updated_at before update on public.mess_settings
  for each row execute function private.set_updated_at();
create trigger mess_members_updated_at before update on public.mess_members
  for each row execute function private.set_updated_at();
create trigger feedback_updated_at before update on public.feedback
  for each row execute function private.set_updated_at();

create trigger messes_audit after insert or update or delete on public.messes
  for each row execute function private.audit_row();
create trigger mess_settings_audit after insert or update on public.mess_settings
  for each row execute function private.audit_row();
create trigger mess_members_audit after insert or update or delete on public.mess_members
  for each row execute function private.audit_row();

-- Rooms belong to one mess; a member can only be placed in a room of their mess.
create or replace function private.check_member_room()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.room_id is not null and not exists (
    select 1 from public.mess_rooms r where r.id = new.room_id and r.mess_id = new.mess_id
  ) then
    raise exception 'room_not_in_mess';
  end if;
  return new;
end;
$$;

create trigger mess_members_room_check before insert or update of room_id on public.mess_members
  for each row execute function private.check_member_room();

-- =============================================================================
-- Core RPCs (called from Next.js server actions with the user's session)
-- =============================================================================

create or replace function private.require_terms(p_uid uuid)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_uid and p.terms_accepted_at is not null) then
    raise exception 'terms_not_accepted';
  end if;
end;
$$;

-- Create a mess; the caller becomes its first manager.
create or replace function public.create_mess(
  p_name           text,
  p_area_id        integer default null,
  p_address        text default null,
  p_building_name  text default null,
  p_description    text default null,
  p_meal_rate_mode public.meal_rate_mode default 'auto',
  p_gender_policy  public.gender_pref default 'any'
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_mess uuid;
begin
  perform private.require_terms(v_uid);
  perform private.check_rate_limit('create_mess:' || v_uid, 3, interval '1 day');

  if exists (select 1 from public.mess_members
             where user_id = v_uid and status in ('pending', 'active', 'inactive')) then
    raise exception 'already_in_mess';
  end if;

  insert into public.messes (name, description, area_id, address, building_name, gender_policy, created_by)
  values (trim(p_name), nullif(trim(p_description), ''), p_area_id::smallint,
          nullif(trim(p_address), ''), nullif(trim(p_building_name), ''), p_gender_policy, v_uid)
  returning id into v_mess;

  insert into public.mess_settings (mess_id, meal_rate_mode) values (v_mess, p_meal_rate_mode);

  insert into public.mess_members (mess_id, user_id, role, status, joined_at, decided_by, decided_at)
  values (v_mess, v_uid, 'manager', 'active', now(), v_uid, now());

  return v_mess;
end;
$$;

create or replace function public.regenerate_invite_code(p_mess_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform private.require_user();
  if private.managed_mess_id() is distinct from p_mess_id then
    raise exception 'not_manager';
  end if;

  perform private.set_internal(true);
  loop
    v_code := private.new_invite_code();
    begin
      update public.messes set invite_code = v_code where id = p_mess_id;
      exit;
    exception when unique_violation then
      -- extremely unlikely collision: try another code
    end;
  end loop;
  perform private.set_internal(false);
  return v_code;
end;
$$;

-- Minimal public card for the join page (non-members cannot read messes).
create or replace function public.get_mess_by_invite(p_code text)
returns table (
  mess_id        uuid,
  name           text,
  area_name_bn   text,
  area_name_en   text,
  address        text,
  gender_policy  public.gender_pref,
  member_count   bigint,
  invite_enabled boolean
)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  perform private.check_rate_limit('invite_lookup:' || v_uid, 30, interval '10 minutes');
  return query
    select m.id, m.name, a.name_bn, a.name_en, m.address, m.gender_policy,
           (select count(*) from public.mess_members mm where mm.mess_id = m.id and mm.status = 'active'),
           m.invite_enabled
    from public.messes m
    left join public.areas a on a.id = m.area_id
    where m.invite_code = upper(trim(p_code)) and m.is_active;
end;
$$;

create or replace function public.request_join(p_code text, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_mess public.messes%rowtype;
  v_id   uuid;
begin
  perform private.require_terms(v_uid);
  perform private.check_rate_limit('join:' || v_uid, 10, interval '1 hour');

  select * into v_mess from public.messes where invite_code = upper(trim(p_code)) and is_active;
  if not found then
    raise exception 'invalid_invite';
  end if;
  if not v_mess.invite_enabled then
    raise exception 'invite_disabled';
  end if;
  if exists (select 1 from public.mess_members
             where user_id = v_uid and status in ('pending', 'active', 'inactive')) then
    raise exception 'already_in_mess';
  end if;

  insert into public.mess_members (mess_id, user_id, role, status, request_note)
  values (v_mess.id, v_uid, 'member', 'pending', left(nullif(trim(p_note), ''), 300))
  returning id into v_id;

  perform private.notify_managers(
    v_mess.id, 'join_request', 'নতুন সদস্যের অনুরোধ',
    private.display_name(v_uid) || ' মেসে যোগ দিতে চায়।', '/manage/members',
    jsonb_build_object('membership_id', v_id, 'user_id', v_uid));
  return v_id;
end;
$$;

create or replace function public.cancel_join_request()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  delete from public.mess_members where user_id = v_uid and status = 'pending';
  if not found then
    raise exception 'no_pending_request';
  end if;
end;
$$;

create or replace function public.decide_join_request(p_membership_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_row public.mess_members%rowtype;
begin
  select * into v_row from public.mess_members where id = p_membership_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if private.managed_mess_id() is distinct from v_row.mess_id then
    raise exception 'not_manager';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  update public.mess_members
     set status = case when p_approve then 'active'::public.member_status else 'rejected'::public.member_status end,
         joined_at = case when p_approve then now() else null end,
         decided_by = v_uid,
         decided_at = now(),
         decision_note = left(nullif(trim(p_note), ''), 300)
   where id = p_membership_id;

  if p_approve then
    perform private.notify(v_row.user_id, v_row.mess_id, 'join_approved',
      'মেসে স্বাগতম!', 'আপনার যোগদানের অনুরোধ অনুমোদিত হয়েছে।', '/dashboard');
  else
    perform private.notify(v_row.user_id, null, 'join_rejected',
      'যোগদানের অনুরোধ গৃহীত হয়নি', coalesce(nullif(trim(p_note), ''), 'ম্যানেজার অনুরোধটি বাতিল করেছেন।'), '/onboarding');
  end if;
end;
$$;

create or replace function public.leave_mess()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_row public.mess_members%rowtype;
  v_balance numeric;
begin
  select * into v_row from public.mess_members
   where user_id = v_uid and status in ('active', 'inactive') for update;
  if not found then
    raise exception 'not_in_mess';
  end if;

  if v_row.role = 'manager'
     and not exists (select 1 from public.mess_members
                     where mess_id = v_row.mess_id and role = 'manager' and status = 'active' and id <> v_row.id)
     and exists (select 1 from public.mess_members
                 where mess_id = v_row.mess_id and status in ('active', 'inactive') and id <> v_row.id) then
    raise exception 'last_manager';
  end if;

  update public.mess_members set status = 'left', left_at = now(), room_id = null where id = v_row.id;

  -- Last person out: deactivate the mess.
  if not exists (select 1 from public.mess_members where mess_id = v_row.mess_id and status in ('active', 'inactive')) then
    perform private.set_internal(true);
    update public.messes set is_active = false, invite_enabled = false where id = v_row.mess_id;
    perform private.set_internal(false);
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where mess_id = v_row.mess_id and user_id = v_uid;

  perform private.notify_managers(v_row.mess_id, 'member_left', 'একজন সদস্য মেস ছেড়েছেন',
    private.display_name(v_uid) || ' মেস ছেড়েছেন। হিসাবের ব্যালেন্স: ' || private.taka(v_balance),
    '/manage/members', jsonb_build_object('user_id', v_uid, 'balance', v_balance));
end;
$$;

-- Manager changes a member's role, status (active / inactive / left) or room.
create or replace function public.update_member(
  p_membership_id uuid,
  p_role          public.mess_role default null,
  p_status        public.member_status default null,
  p_room_id       uuid default null,
  p_seat_label    text default null,
  p_clear_room    boolean default false
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_row public.mess_members%rowtype;
  v_room public.mess_rooms%rowtype;
  v_losing_manager boolean;
begin
  select * into v_row from public.mess_members where id = p_membership_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if private.managed_mess_id() is distinct from v_row.mess_id then
    raise exception 'not_manager';
  end if;
  if v_row.status not in ('active', 'inactive') then
    raise exception 'not_member';
  end if;
  if p_status is not null and p_status not in ('active', 'inactive', 'left') then
    raise exception 'invalid_status';
  end if;

  v_losing_manager := v_row.role = 'manager'
    and (p_role = 'member' or p_status in ('inactive', 'left'));
  if v_losing_manager and not exists (
       select 1 from public.mess_members
       where mess_id = v_row.mess_id and role = 'manager' and status = 'active' and id <> v_row.id) then
    raise exception 'last_manager';
  end if;

  if p_room_id is not null then
    select * into v_room from public.mess_rooms where id = p_room_id and mess_id = v_row.mess_id;
    if not found then
      raise exception 'room_not_in_mess';
    end if;
    if (select count(*) from public.mess_members
        where room_id = p_room_id and status in ('active', 'inactive') and id <> v_row.id) >= v_room.capacity then
      raise exception 'room_full';
    end if;
  end if;

  update public.mess_members
     set role = coalesce(p_role, role),
         status = coalesce(p_status, status),
         left_at = case when p_status = 'left' then now() else left_at end,
         room_id = case when p_clear_room or p_status = 'left' then null
                        when p_room_id is not null then p_room_id
                        else room_id end,
         seat_label = case when p_seat_label is not null then left(nullif(trim(p_seat_label), ''), 20) else seat_label end
   where id = v_row.id;

  if p_status = 'left' then
    perform private.notify(v_row.user_id, null, 'removed_from_mess', 'আপনাকে মেস থেকে সরানো হয়েছে',
      'ম্যানেজার আপনার সদস্যপদ বন্ধ করেছেন। হিসাব জানতে ম্যানেজারের সাথে যোগাযোগ করুন।', '/onboarding');
  elsif p_role is not null and p_role <> v_row.role then
    perform private.notify(v_row.user_id, v_row.mess_id, 'role_changed',
      case when p_role = 'manager' then 'আপনি এখন ম্যানেজার' else 'আপনার ম্যানেজার দায়িত্ব শেষ' end,
      null, '/dashboard');
  end if;
end;
$$;

create or replace function public.accept_legal(p_version text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_version text := left(nullif(trim(p_version), ''), 20);
begin
  if v_version is null then
    raise exception 'invalid_version';
  end if;
  insert into public.legal_acceptances (user_id, document, version)
  values (v_uid, 'terms', v_version), (v_uid, 'privacy', v_version)
  on conflict do nothing;

  perform private.set_internal(true);
  update public.profiles set terms_accepted_at = now(), terms_version = v_version where id = v_uid;
  perform private.set_internal(false);
end;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_count integer;
begin
  update public.notifications
     set read_at = now()
   where user_id = v_uid and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Feedback / contact / bug report. Anonymous visitors share a global limit.
create or replace function public.submit_feedback(
  p_type          public.feedback_type,
  p_message       text,
  p_subject       text default null,
  p_contact_email text default null,
  p_page_url      text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    perform private.check_rate_limit('feedback:anon', 30, interval '1 hour');
  else
    perform private.check_rate_limit('feedback:' || v_uid, 10, interval '1 hour');
  end if;

  insert into public.feedback (user_id, mess_id, type, subject, message, contact_email, page_url)
  values (v_uid, case when v_uid is not null then private.current_mess_id() end, p_type,
          left(nullif(trim(p_subject), ''), 120), trim(p_message),
          nullif(trim(p_contact_email), ''), left(nullif(trim(p_page_url), ''), 300))
  returning id into v_id;
  return v_id;
end;
$$;

-- Display names + avatars for a set of users (marketplace sellers, reviewers,
-- organisers). Takes ids so the whole user list cannot be enumerated.
create or replace function public.get_public_profiles(p_ids uuid[])
returns table (id uuid, full_name text, avatar_url text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if cardinality(p_ids) > 200 then
    raise exception 'too_many_ids';
  end if;
  return query
    select p.id, p.full_name, p.avatar_url
    from public.profiles p
    where p.id = any (p_ids) and not p.is_deleted;
end;
$$;
