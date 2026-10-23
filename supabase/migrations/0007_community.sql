-- =============================================================================
-- MessMate BD · 0007 · Daily life: complaints, chores, polls, notices,
-- local services, marketplace, emergency info, personal budget
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Complaint box
-- -----------------------------------------------------------------------------
create table public.complaints (
  id           uuid primary key default gen_random_uuid(),
  mess_id      uuid not null references public.messes (id) on delete cascade,
  created_by   uuid not null references public.profiles (id) on delete restrict,
  category     public.complaint_category not null,
  title        text not null check (char_length(title) between 3 and 120),
  description  text check (char_length(description) <= 2000),
  photo_path   text check (char_length(photo_path) <= 300),
  status       public.complaint_status not null default 'open',
  priority     public.priority_level not null default 'normal',
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index complaints_mess_status_idx on public.complaints (mess_id, status, created_at desc);

create table public.complaint_updates (
  id             uuid primary key default gen_random_uuid(),
  complaint_id   uuid not null references public.complaints (id) on delete cascade,
  mess_id        uuid not null references public.messes (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete restrict,
  message        text not null check (char_length(message) between 1 and 1000),
  status_change  public.complaint_status,
  created_at     timestamptz not null default now()
);
create index complaint_updates_complaint_idx on public.complaint_updates (complaint_id, created_at);

create or replace function private.guard_complaint()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_is_manager boolean := coalesce(private.managed_mess_id() = coalesce(new.mess_id, old.mess_id), false);
begin
  if private.is_system_call() or private.is_internal() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform private.check_rate_limit('complaint:' || auth.uid(), 10, interval '1 day');
    new.created_by := auth.uid();
    new.status := 'open';
    new.resolved_at := null;
    if not v_is_manager then
      new.priority := case when new.priority = 'urgent' then 'high' else new.priority end;
    end if;
    return new;
  end if;

  new.mess_id := old.mess_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if not v_is_manager then
    -- the author may edit the text while it is still open, nothing else
    if old.status <> 'open' then
      raise exception 'complaint_locked';
    end if;
    new.status := old.status;
    new.priority := old.priority;
    new.resolved_at := old.resolved_at;
  elsif new.status is distinct from old.status then
    new.resolved_at := case when new.status in ('resolved', 'closed') then now() end;
  end if;
  return new;
end;
$$;

create trigger complaints_guard before insert or update on public.complaints
  for each row execute function private.guard_complaint();
create trigger complaints_updated_at before update on public.complaints
  for each row execute function private.set_updated_at();

create or replace function private.after_complaint()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify_managers(new.mess_id, 'complaint_new', 'নতুন অভিযোগ: ' || new.title,
      private.display_name(new.created_by) || ' একটি অভিযোগ জানিয়েছেন।', '/mess/complaints',
      jsonb_build_object('complaint_id', new.id));
  elsif new.status is distinct from old.status then
    perform private.notify(new.created_by, new.mess_id, 'complaint_status', 'অভিযোগের অবস্থা: ' || new.title,
      case new.status when 'in_progress' then 'কাজ চলছে।' when 'resolved' then 'সমাধান হয়েছে।'
                      when 'closed' then 'বন্ধ করা হয়েছে।' else 'আবার খোলা হয়েছে।' end,
      '/mess/complaints', jsonb_build_object('complaint_id', new.id, 'status', new.status));
  end if;
  return null;
end;
$$;

create trigger complaints_after after insert or update of status on public.complaints
  for each row execute function private.after_complaint();

create or replace function private.guard_complaint_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_complaint public.complaints%rowtype;
begin
  select * into v_complaint from public.complaints where id = new.complaint_id;
  new.mess_id := v_complaint.mess_id;
  if private.is_system_call() then
    return new;
  end if;
  new.author_id := auth.uid();
  if new.status_change is not null then
    if coalesce(private.managed_mess_id() = v_complaint.mess_id, false) is false then
      raise exception 'not_manager';
    end if;
    perform private.set_internal(true);
    update public.complaints
       set status = new.status_change,
           resolved_at = case when new.status_change in ('resolved', 'closed') then now() end
     where id = new.complaint_id;
    perform private.set_internal(false);
  end if;
  if new.author_id <> v_complaint.created_by then
    perform private.notify(v_complaint.created_by, v_complaint.mess_id, 'complaint_reply',
      'অভিযোগে নতুন উত্তর: ' || v_complaint.title, left(new.message, 200), '/mess/complaints',
      jsonb_build_object('complaint_id', v_complaint.id));
  end if;
  return new;
end;
$$;

create trigger complaint_updates_guard before insert on public.complaint_updates
  for each row execute function private.guard_complaint_update();

-- -----------------------------------------------------------------------------
-- Chore / bazar duty roster
-- -----------------------------------------------------------------------------
create table public.chores (
  id           uuid primary key default gen_random_uuid(),
  mess_id      uuid not null references public.messes (id) on delete cascade,
  chore_type   public.chore_type not null,
  title        text not null check (char_length(title) between 2 and 100),
  assigned_to  uuid not null references public.profiles (id) on delete restrict,
  due_date     date not null,
  status       public.chore_status not null default 'pending',
  done_at      timestamptz,
  notes        text check (char_length(notes) <= 300),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index chores_mess_due_idx on public.chores (mess_id, due_date);
create index chores_assignee_idx on public.chores (assigned_to, due_date);

create or replace function private.guard_chore()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_active_member(new.mess_id, new.assigned_to)
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    raise exception 'assignee_not_member';
  end if;
  if private.is_system_call() or private.is_internal() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    return new;
  end if;
  if coalesce(private.managed_mess_id() = old.mess_id, false) is false then
    -- the assignee can only tick it off / skip it and leave a note
    new.mess_id := old.mess_id;
    new.chore_type := old.chore_type;
    new.title := old.title;
    new.assigned_to := old.assigned_to;
    new.due_date := old.due_date;
    new.created_by := old.created_by;
  end if;
  new.done_at := case when new.status = 'done' then coalesce(old.done_at, now()) end;
  return new;
end;
$$;

create trigger chores_guard before insert or update on public.chores
  for each row execute function private.guard_chore();
create trigger chores_updated_at before update on public.chores
  for each row execute function private.set_updated_at();

-- Round-robin roster: assigns p_user_ids in turn every p_every_days days.
create or replace function public.generate_chore_roster(
  p_chore_type public.chore_type,
  p_title      text,
  p_start      date,
  p_days       integer,
  p_user_ids   uuid[],
  p_every_days integer default 1
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_mess  uuid := private.managed_mess_id();
  v_n     integer := coalesce(cardinality(p_user_ids), 0);
  v_count integer := 0;
  v_day   integer := 0;
  v_user  uuid;
begin
  if v_mess is null then
    raise exception 'not_manager';
  end if;
  if v_n = 0 or p_days is null or p_days < 1 or p_days > 62 or p_every_days < 1 or p_every_days > 31 then
    raise exception 'invalid_roster';
  end if;
  if exists (select 1 from unnest(p_user_ids) u where not private.is_active_member(v_mess, u)) then
    raise exception 'assignee_not_member';
  end if;

  while v_day < p_days loop
    v_user := p_user_ids[(v_count % v_n) + 1];
    insert into public.chores (mess_id, chore_type, title, assigned_to, due_date, created_by)
    values (v_mess, p_chore_type, trim(p_title), v_user, p_start + v_day, v_uid);
    v_count := v_count + 1;
    v_day := v_day + p_every_days;
  end loop;

  insert into public.notifications (user_id, mess_id, type, title, body, link)
  select distinct u, v_mess, 'chore_assigned', 'নতুন দায়িত্ব: ' || trim(p_title),
         'রোস্টারে আপনার নাম আছে। তারিখ দেখে নিন।', '/mess/roster'
    from unnest(p_user_ids) u;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Polls
-- -----------------------------------------------------------------------------
create table public.polls (
  id              uuid primary key default gen_random_uuid(),
  mess_id         uuid not null references public.messes (id) on delete cascade,
  question        text not null check (char_length(question) between 3 and 200),
  description     text check (char_length(description) <= 1000),
  created_by      uuid not null references public.profiles (id) on delete restrict,
  allow_multiple  boolean not null default false,
  is_anonymous    boolean not null default false,
  closes_at       timestamptz,
  is_closed       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index polls_mess_idx on public.polls (mess_id, created_at desc);

create table public.poll_options (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 100),
  sort_order  smallint not null default 0,
  unique (poll_id, label)
);

create table public.poll_votes (
  poll_id     uuid not null references public.polls (id) on delete cascade,
  option_id   uuid not null references public.poll_options (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);
create index poll_votes_user_idx on public.poll_votes (user_id);

create trigger polls_updated_at before update on public.polls
  for each row execute function private.set_updated_at();

create or replace function private.guard_poll()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_system_call() or private.is_internal() then
    return new;
  end if;
  -- only open/close and wording can change after creation
  new.mess_id := old.mess_id;
  new.created_by := old.created_by;
  new.allow_multiple := old.allow_multiple;
  new.is_anonymous := old.is_anonymous;
  return new;
end;
$$;

create trigger polls_guard before update on public.polls
  for each row execute function private.guard_poll();

create or replace function public.create_poll(
  p_question       text,
  p_options        text[],
  p_description    text default null,
  p_allow_multiple boolean default false,
  p_is_anonymous   boolean default false,
  p_closes_at      timestamptz default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_mess uuid := private.current_mess_id();
  v_id   uuid;
  v_opts text[];
begin
  if v_mess is null or not private.is_active_member(v_mess, v_uid) then
    raise exception 'not_member';
  end if;
  perform private.check_rate_limit('poll:' || v_uid, 10, interval '1 day');
  select array_agg(distinct trim(o)) into v_opts from unnest(p_options) o where nullif(trim(o), '') is not null;
  if coalesce(cardinality(v_opts), 0) < 2 or cardinality(v_opts) > 10 then
    raise exception 'poll_needs_2_to_10_options';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'invalid_close_time';
  end if;

  insert into public.polls (mess_id, question, description, created_by, allow_multiple, is_anonymous, closes_at)
  values (v_mess, trim(p_question), nullif(trim(p_description), ''), v_uid, p_allow_multiple, p_is_anonymous, p_closes_at)
  returning id into v_id;

  insert into public.poll_options (poll_id, label, sort_order)
  select v_id, left(trim(o.label), 100), o.ord::smallint
    from unnest(p_options) with ordinality as o(label, ord)
   where nullif(trim(o.label), '') is not null
  on conflict (poll_id, label) do nothing;

  perform private.notify_mess(v_mess, 'poll_new', 'নতুন ভোট: ' || trim(p_question),
    private.display_name(v_uid) || ' একটি ভোট শুরু করেছেন।', '/mess/polls',
    jsonb_build_object('poll_id', v_id), v_uid);
  return v_id;
end;
$$;

create or replace function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_poll public.polls%rowtype;
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if not found then
    raise exception 'not_found';
  end if;
  if not private.is_active_member(v_poll.mess_id, v_uid) then
    raise exception 'not_member';
  end if;
  if v_poll.is_closed or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    raise exception 'poll_closed';
  end if;
  if coalesce(cardinality(p_option_ids), 0) = 0 then
    raise exception 'no_option_selected';
  end if;
  if not v_poll.allow_multiple and cardinality(p_option_ids) > 1 then
    raise exception 'single_choice_only';
  end if;
  if exists (select 1 from unnest(p_option_ids) o
             where not exists (select 1 from public.poll_options po where po.id = o and po.poll_id = p_poll_id)) then
    raise exception 'invalid_option';
  end if;

  delete from public.poll_votes where poll_id = p_poll_id and user_id = v_uid;
  insert into public.poll_votes (poll_id, option_id, user_id)
  select p_poll_id, o, v_uid from (select distinct unnest(p_option_ids) as o) x;
end;
$$;

create or replace function public.poll_results(p_poll_id uuid)
returns table (option_id uuid, label text, votes bigint, voted_by_me boolean, voters text[])
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_poll public.polls%rowtype;
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if not found or v_poll.mess_id is distinct from private.current_mess_id() then
    raise exception 'not_found';
  end if;
  return query
    select po.id, po.label,
           count(pv.user_id),
           coalesce(bool_or(pv.user_id = v_uid), false),
           case when v_poll.is_anonymous then null
                else array_remove(array_agg(pr.full_name order by pr.full_name), null) end
      from public.poll_options po
      left join public.poll_votes pv on pv.option_id = po.id
      left join public.profiles pr on pr.id = pv.user_id
     where po.poll_id = p_poll_id
     group by po.id, po.label, po.sort_order
     order by po.sort_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Notice board
-- -----------------------------------------------------------------------------
create table public.notices (
  id          uuid primary key default gen_random_uuid(),
  mess_id     uuid not null references public.messes (id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  body        text not null check (char_length(body) between 1 and 3000),
  priority    public.priority_level not null default 'normal',
  is_pinned   boolean not null default false,
  expires_at  timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notices_mess_idx on public.notices (mess_id, is_pinned desc, created_at desc);

create or replace function private.after_notice()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.notify_mess(new.mess_id,
    case when new.priority = 'urgent' then 'notice_urgent' else 'notice' end,
    'নোটিশ: ' || new.title, left(new.body, 200), '/mess/notices',
    jsonb_build_object('notice_id', new.id), new.created_by);
  return null;
end;
$$;

create or replace function private.notice_defaults()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

create trigger notices_defaults before insert on public.notices
  for each row execute function private.notice_defaults();
create trigger notices_after after insert on public.notices
  for each row execute function private.after_notice();
create trigger notices_updated_at before update on public.notices
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Verified local service directory (+ tiffin / home-cooked food)
-- -----------------------------------------------------------------------------
create table public.service_providers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 100),
  category      public.service_category not null,
  area_id       smallint references public.areas (id) on delete set null,
  phone         text not null check (phone ~ '^\+?[0-9]{10,14}$'),
  alt_phone     text check (alt_phone ~ '^\+?[0-9]{10,14}$'),
  description   text check (char_length(description) <= 1000),
  price_note    text check (char_length(price_note) <= 120),
  is_verified   boolean not null default false,
  verified_at   timestamptz,
  owner_id      uuid references public.profiles (id) on delete set null,
  status        public.moderation_status not null default 'pending',
  avg_rating    numeric(3,2) not null default 0,
  rating_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index service_providers_browse_idx on public.service_providers (status, category, area_id);

create table public.service_reviews (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references public.service_providers (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  comment      text check (char_length(comment) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (provider_id, user_id)
);

create or replace function private.guard_service()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_system_call() or private.is_internal() or private.is_super_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform private.check_rate_limit('service:' || auth.uid(), 5, interval '1 day');
    new.owner_id := auth.uid();
    new.status := 'pending';
    new.is_verified := false;
    new.verified_at := null;
    new.avg_rating := 0;
    new.rating_count := 0;
    return new;
  end if;
  new.owner_id := old.owner_id;
  new.is_verified := old.is_verified;
  new.verified_at := old.verified_at;
  new.avg_rating := old.avg_rating;
  new.rating_count := old.rating_count;
  if new.status is distinct from old.status and new.status <> 'archived' then
    new.status := old.status;
  end if;
  if (new.name, new.category, new.phone, new.alt_phone, new.description, new.area_id)
     is distinct from (old.name, old.category, old.phone, old.alt_phone, old.description, old.area_id)
     and new.status <> 'archived' then
    new.status := 'pending';
    new.is_verified := false;
  end if;
  return new;
end;
$$;

create trigger service_providers_guard before insert or update on public.service_providers
  for each row execute function private.guard_service();
create trigger service_providers_updated_at before update on public.service_providers
  for each row execute function private.set_updated_at();

create or replace function private.guard_service_review()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_system_call() then
    new.user_id := auth.uid();
    if exists (select 1 from public.service_providers sp where sp.id = new.provider_id and sp.owner_id = new.user_id) then
      raise exception 'cannot_review_own_service';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.refresh_service_rating()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_provider uuid := coalesce(new.provider_id, old.provider_id);
begin
  perform private.set_internal(true);
  update public.service_providers sp
     set avg_rating = coalesce((select round(avg(r.rating), 2) from public.service_reviews r where r.provider_id = v_provider), 0),
         rating_count = (select count(*) from public.service_reviews r where r.provider_id = v_provider)
   where sp.id = v_provider;
  perform private.set_internal(false);
  return null;
end;
$$;

create trigger service_reviews_guard before insert or update on public.service_reviews
  for each row execute function private.guard_service_review();
create trigger service_reviews_rating after insert or update or delete on public.service_reviews
  for each row execute function private.refresh_service_rating();
create trigger service_reviews_updated_at before update on public.service_reviews
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Second-hand marketplace
-- -----------------------------------------------------------------------------
create table public.market_items (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references public.profiles (id) on delete cascade,
  title          text not null check (char_length(title) between 3 and 100),
  description    text check (char_length(description) <= 1500),
  category       public.market_category not null,
  condition      public.item_condition not null default 'good',
  price          numeric(10,2) not null check (price >= 0 and price <= 1000000),
  is_negotiable  boolean not null default true,
  area_id        smallint references public.areas (id) on delete set null,
  mess_id        uuid references public.messes (id) on delete set null,
  contact_phone  text check (contact_phone ~ '^\+?[0-9]{10,14}$'),
  status         public.market_status not null default 'available',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index market_items_browse_idx on public.market_items (status, category, area_id, created_at desc);

create table public.market_item_photos (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.market_items (id) on delete cascade,
  storage_path  text not null check (char_length(storage_path) <= 300),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);
create index market_item_photos_item_idx on public.market_item_photos (item_id, sort_order);

create or replace function private.guard_market_item()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_system_call() or private.is_super_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform private.check_rate_limit('market:' || auth.uid(), 10, interval '1 day');
    new.seller_id := auth.uid();
    new.mess_id := private.current_mess_id();
    if new.status = 'removed' then
      new.status := 'available';
    end if;
    return new;
  end if;
  new.seller_id := old.seller_id;
  if old.status = 'removed' then
    raise exception 'item_removed_by_moderator';
  end if;
  if new.status = 'removed' then
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger market_items_guard before insert or update on public.market_items
  for each row execute function private.guard_market_item();
create trigger market_items_updated_at before update on public.market_items
  for each row execute function private.set_updated_at();

create or replace function private.guard_market_photo()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_seller uuid;
begin
  select seller_id into v_seller from public.market_items where id = new.item_id;
  if not private.is_system_call() and new.storage_path not like v_seller::text || '/%' then
    raise exception 'invalid_photo_path';
  end if;
  if (select count(*) from public.market_item_photos where item_id = new.item_id) >= 6 then
    raise exception 'too_many_photos';
  end if;
  return new;
end;
$$;

create trigger market_item_photos_guard before insert on public.market_item_photos
  for each row execute function private.guard_market_photo();

-- -----------------------------------------------------------------------------
-- Emergency info (public reference) + personal emergency contacts
-- -----------------------------------------------------------------------------
create table public.emergency_places (
  id           uuid primary key default gen_random_uuid(),
  kind         public.place_kind not null,
  name_bn      text not null check (char_length(name_bn) between 2 and 120),
  name_en      text not null check (char_length(name_en) between 2 and 120),
  area_id      smallint references public.areas (id) on delete set null,
  phone        text check (char_length(phone) <= 40),
  address      text check (char_length(address) <= 200),
  lat          numeric(9,6),
  lng          numeric(9,6),
  is_24h       boolean not null default false,
  website      text check (char_length(website) <= 200),
  notes        text check (char_length(notes) <= 300),
  verified_on  date,
  source_url   text check (char_length(source_url) <= 300),
  sort_order   smallint not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index emergency_places_kind_idx on public.emergency_places (kind, area_id);

create trigger emergency_places_updated_at before update on public.emergency_places
  for each row execute function private.set_updated_at();

-- Personal contacts. If a contact is a messmate (contact_user_id), Care alerts
-- reach them inside the app; others get a ready-made WhatsApp/SMS link.
create table public.emergency_contacts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 80),
  relation           text check (char_length(relation) <= 40),
  phone              text not null check (phone ~ '^\+?[0-9]{10,14}$'),
  contact_user_id    uuid references public.profiles (id) on delete set null,
  is_primary         boolean not null default false,
  notify_on_sos      boolean not null default true,
  notify_on_sick     boolean not null default true,
  notify_on_checkin  boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint emergency_contact_not_self check (contact_user_id is distinct from user_id)
);
create index emergency_contacts_user_idx on public.emergency_contacts (user_id);
create index emergency_contacts_contact_idx on public.emergency_contacts (contact_user_id);

create or replace function private.guard_emergency_contact()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_system_call() then
    return new;
  end if;
  new.user_id := auth.uid();
  if tg_op = 'INSERT' and (select count(*) from public.emergency_contacts where user_id = new.user_id) >= 10 then
    raise exception 'too_many_contacts';
  end if;
  if new.contact_user_id is not null
     and (tg_op = 'INSERT' or new.contact_user_id is distinct from old.contact_user_id)
     and not private.shares_mess(new.contact_user_id) then
    raise exception 'contact_must_be_messmate';
  end if;
  return new;
end;
$$;

create trigger emergency_contacts_guard before insert or update on public.emergency_contacts
  for each row execute function private.guard_emergency_contact();
create trigger emergency_contacts_updated_at before update on public.emergency_contacts
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Personal budget tracker
-- -----------------------------------------------------------------------------
create table public.budget_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  entry_type  public.budget_entry_type not null,
  category    public.budget_category not null,
  amount      numeric(10,2) not null check (amount > 0 and amount <= 10000000),
  entry_date  date not null default private.dhaka_today(),
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now()
);
create index budget_entries_user_date_idx on public.budget_entries (user_id, entry_date desc);

create table public.monthly_budgets (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  period_month     date not null check (period_month = date_trunc('month', period_month::timestamp)::date),
  limit_amount     numeric(10,2) not null check (limit_amount > 0),
  expected_income  numeric(10,2) check (expected_income >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, period_month)
);

create trigger monthly_budgets_updated_at before update on public.monthly_budgets
  for each row execute function private.set_updated_at();
