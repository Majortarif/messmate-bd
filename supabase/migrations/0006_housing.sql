-- =============================================================================
-- MessMate BD · 0006 · Housing: listings, roommate matching, rent tracker,
-- move-in / move-out checklists
-- =============================================================================

create table public.listings (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  listing_type      public.listing_type not null,
  title             text not null check (char_length(title) between 5 and 120),
  description       text check (char_length(description) <= 2000),
  area_id           smallint not null references public.areas (id),
  address_line      text check (char_length(address_line) <= 200),
  lat               numeric(9,6) check (lat between 20 and 27),
  lng               numeric(9,6) check (lng between 88 and 93),
  rent              numeric(10,2) not null check (rent >= 0 and rent <= 1000000),
  advance_deposit   numeric(10,2) not null default 0 check (advance_deposit >= 0),
  available_from    date,
  gender_pref       public.gender_pref not null default 'any',
  tenant_pref       public.tenant_pref not null default 'any',
  seats_available   smallint not null default 1 check (seats_available between 0 and 50),
  facilities        text[] not null default '{}' check (facilities <@ array[
                      'wifi', 'gas', 'lift', 'generator', 'ips', 'attached_bath', 'balcony', 'parking',
                      'security', 'cctv', 'water_filter', 'furnished', 'kitchen', 'meal_system', 'laundry']::text[]),
  contact_name      text check (char_length(contact_name) <= 80),
  contact_phone     text not null check (contact_phone ~ '^\+?[0-9]{10,14}$'),
  status            public.moderation_status not null default 'pending',
  is_filled         boolean not null default false,
  rejection_reason  text check (char_length(rejection_reason) <= 300),
  moderated_by      uuid references public.profiles (id) on delete set null,
  moderated_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index listings_browse_idx on public.listings (status, area_id, listing_type, rent);
create index listings_owner_idx on public.listings (owner_id);

create table public.listing_photos (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  storage_path  text not null check (char_length(storage_path) <= 300),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);
create index listing_photos_listing_idx on public.listing_photos (listing_id, sort_order);

create table public.saved_listings (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- Generic moderation guard for community content (listings, services, recipes,
-- events, jobs, market). Owners can edit/archive; content edits go back to
-- review; only super admins approve or reject.
create or replace function private.guard_listing()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_active integer;
begin
  if private.is_system_call() or private.is_internal() or private.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform private.check_rate_limit('listing:' || auth.uid(), 5, interval '1 day');
    select count(*) into v_active from public.listings
     where owner_id = auth.uid() and status in ('pending', 'approved');
    if v_active >= 10 then
      raise exception 'too_many_listings';
    end if;
    new.owner_id := auth.uid();
    new.status := 'pending';
    new.rejection_reason := null;
    new.moderated_by := null;
    new.moderated_at := null;
    return new;
  end if;

  new.owner_id := old.owner_id;
  new.moderated_by := old.moderated_by;
  new.moderated_at := old.moderated_at;
  new.created_at := old.created_at;
  if new.status is distinct from old.status and new.status <> 'archived'
     and not (old.status = 'archived' and new.status = 'pending') then
    new.status := old.status;
  end if;
  if (new.listing_type, new.title, new.description, new.area_id, new.address_line, new.rent,
      new.advance_deposit, new.contact_phone, new.facilities)
     is distinct from
     (old.listing_type, old.title, old.description, old.area_id, old.address_line, old.rent,
      old.advance_deposit, old.contact_phone, old.facilities)
     and new.status <> 'archived' then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

create trigger listings_guard before insert or update on public.listings
  for each row execute function private.guard_listing();
create trigger listings_updated_at before update on public.listings
  for each row execute function private.set_updated_at();
create trigger listings_audit after update of status on public.listings
  for each row execute function private.audit_row();

create or replace function private.guard_listing_photo()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.listings where id = new.listing_id;
  if not private.is_system_call() and new.storage_path not like v_owner::text || '/%' then
    raise exception 'invalid_photo_path';
  end if;
  if (select count(*) from public.listing_photos where listing_id = new.listing_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end;
$$;

create trigger listing_photos_guard before insert on public.listing_photos
  for each row execute function private.guard_listing_photo();

-- -----------------------------------------------------------------------------
-- Roommate matching
-- -----------------------------------------------------------------------------
create table public.roommate_profiles (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  is_active       boolean not null default true,
  gender          public.gender_type not null,
  occupation      public.occupation_type not null,
  budget_min      numeric(10,2) not null check (budget_min >= 0),
  budget_max      numeric(10,2) not null check (budget_max <= 200000),
  smoking         boolean not null default false,
  sleep_schedule  text not null default 'flexible' check (sleep_schedule in ('early', 'late', 'flexible')),
  cleanliness     smallint not null default 3 check (cleanliness between 1 and 5),
  food_pref       text not null default 'any' check (food_pref in ('any', 'halal_only', 'vegetarian')),
  guests_ok       boolean not null default true,
  move_in_date    date,
  about           text check (char_length(about) <= 500),
  contact_phone   text check (contact_phone ~ '^\+?[0-9]{10,14}$'),
  show_phone      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint roommate_budget_range check (budget_max >= budget_min)
);
create index roommate_profiles_active_idx on public.roommate_profiles (gender, is_active);

create table public.roommate_area_prefs (
  user_id  uuid not null references public.roommate_profiles (user_id) on delete cascade,
  area_id  smallint not null references public.areas (id) on delete cascade,
  primary key (user_id, area_id)
);
create index roommate_area_prefs_area_idx on public.roommate_area_prefs (area_id);

create trigger roommate_profiles_updated_at before update on public.roommate_profiles
  for each row execute function private.set_updated_at();

-- Rule-based compatibility (0–100). Same-gender only; contact phone is shared
-- only when the other person opted in. Weights:
--   budget 25 · area 20 · smoking 15 · sleep 10 · cleanliness 10 ·
--   occupation 10 · food 5 · guests 5
create or replace function public.roommate_matches(p_limit integer default 20)
returns table (
  user_id        uuid,
  full_name      text,
  avatar_url     text,
  occupation     public.occupation_type,
  institution    text,
  budget_min     numeric,
  budget_max     numeric,
  smoking        boolean,
  sleep_schedule text,
  cleanliness    smallint,
  food_pref      text,
  guests_ok      boolean,
  move_in_date   date,
  about          text,
  area_names     text[],
  contact_phone  text,
  score          integer,
  reasons        text[]
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  me    public.roommate_profiles%rowtype;
  v_my_areas smallint[];
begin
  select * into me from public.roommate_profiles rp where rp.user_id = v_uid and rp.is_active;
  if not found then
    raise exception 'roommate_profile_required';
  end if;
  select coalesce(array_agg(ap.area_id), '{}') into v_my_areas
    from public.roommate_area_prefs ap where ap.user_id = v_uid;

  return query
  with cand as (
    select rp.*, p.full_name as c_name, p.avatar_url as c_avatar, p.institution as c_institution,
           coalesce((select array_agg(ap.area_id) from public.roommate_area_prefs ap where ap.user_id = rp.user_id), '{}') as c_areas
      from public.roommate_profiles rp
      join public.profiles p on p.id = rp.user_id
     where rp.is_active and rp.user_id <> v_uid and rp.gender = me.gender and not p.is_deleted
  ),
  scored as (
    select c.*,
           -- budget: full marks when ranges overlap, fading with the gap
           case when least(c.budget_max, me.budget_max) >= greatest(c.budget_min, me.budget_min) then 25
                else greatest(0, 25 - round(25 * (greatest(c.budget_min, me.budget_min) - least(c.budget_max, me.budget_max))
                                             / greatest(me.budget_max, 1)))::integer end as s_budget,
           case when c.c_areas && v_my_areas then 20
                when cardinality(c.c_areas) = 0 or cardinality(v_my_areas) = 0 then 10
                else 0 end as s_area,
           case when c.smoking = me.smoking then 15 else 0 end as s_smoking,
           case when c.sleep_schedule = me.sleep_schedule then 10
                when 'flexible' in (c.sleep_schedule, me.sleep_schedule) then 6
                else 0 end as s_sleep,
           greatest(0, round(10 - abs(c.cleanliness - me.cleanliness) * 2.5))::integer as s_clean,
           case when c.occupation = me.occupation then 10 else 4 end as s_occupation,
           case when c.food_pref = me.food_pref or 'any' in (c.food_pref, me.food_pref) then 5 else 0 end as s_food,
           case when c.guests_ok = me.guests_ok then 5 else 2 end as s_guests
      from cand c
  )
  select sc.user_id, sc.c_name, sc.c_avatar, sc.occupation, sc.c_institution,
         sc.budget_min, sc.budget_max, sc.smoking, sc.sleep_schedule, sc.cleanliness,
         sc.food_pref, sc.guests_ok, sc.move_in_date, sc.about,
         (select array_agg(a.name_bn order by a.sort_order) from public.areas a where a.id = any (sc.c_areas)),
         case when sc.show_phone then sc.contact_phone end,
         (sc.s_budget + sc.s_area + sc.s_smoking + sc.s_sleep + sc.s_clean + sc.s_occupation + sc.s_food + sc.s_guests)::integer,
         array_remove(array[
           case when sc.s_budget = 25 then 'budget' end,
           case when sc.s_area = 20 then 'area' end,
           case when sc.s_smoking = 15 then 'smoking' end,
           case when sc.s_sleep = 10 then 'sleep' end,
           case when sc.s_clean >= 8 then 'cleanliness' end,
           case when sc.s_occupation = 10 then 'occupation' end,
           case when sc.s_food = 5 then 'food' end,
           case when sc.s_guests = 5 then 'guests' end], null)
    from scored sc
   order by 17 desc, sc.updated_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- -----------------------------------------------------------------------------
-- Personal rent + deposit tracker
-- -----------------------------------------------------------------------------
create table public.rent_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  title               text not null check (char_length(title) between 2 and 80),
  landlord_name       text check (char_length(landlord_name) <= 80),
  landlord_phone      text check (landlord_phone ~ '^\+?[0-9]{10,14}$'),
  property_address    text check (char_length(property_address) <= 200),
  monthly_rent        numeric(10,2) not null check (monthly_rent >= 0),
  advance_paid        numeric(10,2) not null default 0 check (advance_paid >= 0),
  security_deposit    numeric(10,2) not null default 0 check (security_deposit >= 0),
  rent_due_day        smallint not null default 5 check (rent_due_day between 1 and 28),
  agreement_start     date,
  agreement_end       date,
  notice_period_days  smallint check (notice_period_days between 0 and 365),
  agreement_notes     text check (char_length(agreement_notes) <= 3000),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint rent_agreement_dates check (agreement_end is null or agreement_start is null or agreement_end >= agreement_start)
);
create index rent_records_user_idx on public.rent_records (user_id);

create table public.rent_payments (
  id              uuid primary key default gen_random_uuid(),
  rent_record_id  uuid not null references public.rent_records (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  period_month    date not null check (period_month = date_trunc('month', period_month::timestamp)::date),
  amount          numeric(10,2) not null check (amount > 0),
  paid_on         date not null default private.dhaka_today(),
  method          public.payment_method not null default 'cash',
  note            text check (char_length(note) <= 200),
  created_at      timestamptz not null default now(),
  unique (rent_record_id, period_month)
);
create index rent_payments_user_idx on public.rent_payments (user_id, period_month desc);

create or replace function private.guard_rent_payment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  select r.user_id into new.user_id from public.rent_records r where r.id = new.rent_record_id;
  return new;
end;
$$;

create trigger rent_payments_owner before insert or update on public.rent_payments
  for each row execute function private.guard_rent_payment();
create trigger rent_records_updated_at before update on public.rent_records
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Move-in / move-out checklist + handover record
-- -----------------------------------------------------------------------------
create table public.move_checklists (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  kind               public.move_kind not null,
  title              text not null check (char_length(title) between 2 and 100),
  property_address   text check (char_length(property_address) <= 200),
  scheduled_date     date,
  handover_to        text check (char_length(handover_to) <= 80),
  handover_phone     text check (handover_phone ~ '^\+?[0-9]{10,14}$'),
  electricity_meter  numeric(12,2),
  gas_meter          numeric(12,2),
  water_meter        numeric(12,2),
  keys_count         smallint check (keys_count between 0 and 50),
  deposit_amount     numeric(10,2) check (deposit_amount >= 0),
  deposit_returned   numeric(10,2) check (deposit_returned >= 0),
  handover_notes     text check (char_length(handover_notes) <= 2000),
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index move_checklists_user_idx on public.move_checklists (user_id, created_at desc);

create table public.move_checklist_items (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references public.move_checklists (id) on delete cascade,
  label         text not null check (char_length(label) between 1 and 150),
  is_done       boolean not null default false,
  note          text check (char_length(note) <= 300),
  photo_path    text check (char_length(photo_path) <= 300),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);
create index move_checklist_items_list_idx on public.move_checklist_items (checklist_id, sort_order);

create trigger move_checklists_updated_at before update on public.move_checklists
  for each row execute function private.set_updated_at();

-- Creates a checklist pre-filled with a practical Dhaka template.
create or replace function public.create_move_checklist(
  p_kind    public.move_kind,
  p_title   text,
  p_address text default null,
  p_date    date default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_id    uuid;
  v_items text[];
begin
  if (select count(*) from public.move_checklists where user_id = v_uid) >= 20 then
    raise exception 'too_many_checklists';
  end if;

  insert into public.move_checklists (user_id, kind, title, property_address, scheduled_date)
  values (v_uid, p_kind, trim(p_title), nullif(trim(p_address), ''), p_date)
  returning id into v_id;

  v_items := case p_kind
    when 'move_in' then array[
      'চুক্তিপত্র পড়ে সই করুন, একটি কপি নিজের কাছে রাখুন',
      'অগ্রিম ও জামানতের লিখিত রসিদ নিন',
      'বিদ্যুৎ, গ্যাস ও পানির মিটার রিডিং ছবি সহ লিখে রাখুন',
      'দরজা-জানালার লক ও সব চাবি গুনে বুঝে নিন',
      'ফ্যান, লাইট, সুইচ ও প্লাগ ঠিক আছে কিনা দেখুন',
      'বাথরুমের কল, ফ্লাশ ও পানির লিক চেক করুন',
      'দেয়াল ও মেঝের আগের দাগ/ক্ষতির ছবি তুলে রাখুন',
      'ইন্টারনেট সংযোগের ব্যবস্থা করুন',
      'বাড়িওয়ালা ও কেয়ারটেকারের নম্বর সেভ করুন',
      'কাছের ফার্মেসি, হাসপাতাল ও থানা চিনে নিন',
      'থানায় ভাড়াটিয়া তথ্য ফরম জমা দিন']
    else array[
      'চুক্তি অনুযায়ী বাড়িওয়ালাকে লিখিত নোটিশ দিন',
      'শেষ মাসের ভাড়া ও সব বিল পরিশোধ করুন',
      'মেস/ফ্ল্যাটের সব হিসাব মিলিয়ে নিন',
      'বিদ্যুৎ, গ্যাস ও পানির মিটার রিডিং ছবি সহ লিখে রাখুন',
      'রুম পরিষ্কার করে ছবি তুলে রাখুন',
      'সব চাবি বুঝিয়ে দিন',
      'জামানতের টাকা ফেরত নিন',
      'ইন্টারনেট/গ্যাস সংযোগ বাতিল বা হস্তান্তর করুন',
      'নতুন ঠিকানা জানান (অফিস, ব্যাংক, কুরিয়ার)',
      'হস্তান্তর নোটে দুই পক্ষের সই নিন']
  end;

  insert into public.move_checklist_items (checklist_id, label, sort_order)
  select v_id, t.label, t.ord::smallint
    from unnest(v_items) with ordinality as t(label, ord);
  return v_id;
end;
$$;
