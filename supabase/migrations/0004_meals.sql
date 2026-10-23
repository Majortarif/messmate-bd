-- =============================================================================
-- MessMate BD · 0004 · Daily menu + meal orders
--
-- Two billing modes (mess_settings.meal_rate_mode):
--   fixed : each order is charged the menu price immediately (prepaid wallet)
--   auto  : orders are only counted; at month close the meal rate =
--           meal expenses ÷ total meal units, and each member is charged
--           units × rate (classic Dhaka mess system)
-- =============================================================================

create table public.menus (
  id          uuid primary key default gen_random_uuid(),
  mess_id     uuid not null references public.messes (id) on delete cascade,
  menu_date   date not null,
  slot        public.meal_slot not null,
  items       text not null check (char_length(items) between 2 and 200),
  price       numeric(10,2) check (price >= 0 and price <= 2000),
  cutoff_at   timestamptz,
  is_locked   boolean not null default false,
  notes       text check (char_length(notes) <= 200),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (mess_id, menu_date, slot),
  unique (id, mess_id)
);
create index menus_mess_date_idx on public.menus (mess_id, menu_date);

create table public.meal_orders (
  id              uuid primary key default gen_random_uuid(),
  mess_id         uuid not null,
  menu_id         uuid not null,
  user_id         uuid not null references public.profiles (id) on delete restrict,
  status          public.order_status not null default 'ordered',
  guest_count     smallint not null default 0 check (guest_count between 0 and 10),
  charged_amount  numeric(10,2) not null default 0 check (charged_amount >= 0),
  ordered_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (menu_id, user_id),
  -- composite FK keeps the denormalised mess_id honest
  foreign key (menu_id, mess_id) references public.menus (id, mess_id) on delete cascade
);
create index meal_orders_mess_user_idx on public.meal_orders (mess_id, user_id);
create index meal_orders_menu_idx on public.meal_orders (menu_id, status);

-- Defaults (price + cutoff from mess settings) and month-lock / price-lock rules.
create or replace function private.menu_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.mess_settings%rowtype;
begin
  if tg_op = 'DELETE' then
    if private.is_purge() then
      return old;
    end if;
    if private.is_month_closed(old.mess_id, old.menu_date) then
      raise exception 'month_closed';
    end if;
    if exists (select 1 from public.meal_orders o where o.menu_id = old.id and o.status = 'ordered') then
      raise exception 'menu_has_orders';
    end if;
    return old;
  end if;

  if private.is_month_closed(new.mess_id, new.menu_date) then
    raise exception 'month_closed';
  end if;

  if tg_op = 'UPDATE' then
    if new.mess_id <> old.mess_id or new.menu_date <> old.menu_date or new.slot <> old.slot then
      raise exception 'menu_identity_locked';
    end if;
    if new.price is distinct from old.price and exists (
         select 1 from public.meal_orders o
         where o.menu_id = old.id and o.status = 'ordered' and o.charged_amount > 0) then
      raise exception 'menu_price_locked';
    end if;
  else
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  select * into s from public.mess_settings where mess_id = new.mess_id;
  if not found then
    raise exception 'mess_settings_missing';
  end if;

  if new.price is null then
    new.price := case new.slot when 'breakfast' then s.breakfast_price
                               when 'lunch' then s.lunch_price
                               else s.dinner_price end;
  end if;
  if new.cutoff_at is null then
    new.cutoff_at := case new.slot
      when 'breakfast' then private.dhaka_ts(new.menu_date - case when s.breakfast_cutoff_prev_day then 1 else 0 end, s.breakfast_cutoff)
      when 'lunch'     then private.dhaka_ts(new.menu_date - case when s.lunch_cutoff_prev_day then 1 else 0 end, s.lunch_cutoff)
      else                  private.dhaka_ts(new.menu_date - case when s.dinner_cutoff_prev_day then 1 else 0 end, s.dinner_cutoff)
    end;
  end if;
  return new;
end;
$$;

create trigger menus_guard before insert or update or delete on public.menus
  for each row execute function private.menu_guard();
create trigger menus_updated_at before update on public.menus
  for each row execute function private.set_updated_at();

-- Orders of a closed month are frozen (their units fed the meal rate).
create or replace function private.meal_order_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_menu_date date;
  v_mess uuid;
begin
  if private.is_purge() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select m.menu_date, m.mess_id into v_menu_date, v_mess
    from public.menus m where m.id = coalesce(new.menu_id, old.menu_id);
  if v_menu_date is not null and private.is_month_closed(v_mess, v_menu_date) then
    raise exception 'month_closed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger meal_orders_guard before insert or update or delete on public.meal_orders
  for each row execute function private.meal_order_guard();
create trigger meal_orders_updated_at before update on public.meal_orders
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Order / cancel / guest meals — one idempotent call for every toggle in the UI.
--   p_ordered = false cancels. Managers may act for a member and ignore cutoff.
-- -----------------------------------------------------------------------------
create or replace function public.set_meal_order(
  p_menu_id     uuid,
  p_ordered     boolean,
  p_guest_count integer default 0,
  p_user_id     uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid        uuid := private.require_user();
  v_menu       public.menus%rowtype;
  s            public.mess_settings%rowtype;
  v_target     uuid := coalesce(p_user_id, v_uid);
  v_is_manager boolean;
  v_order      public.meal_orders%rowtype;
  v_guests     integer := case when p_ordered then coalesce(p_guest_count, 0) else 0 end;
  v_units      integer;
  v_new_cost   numeric(10,2) := 0;
  v_delta      numeric(10,2);
  v_balance    numeric;
begin
  select * into v_menu from public.menus where id = p_menu_id;
  if not found then
    raise exception 'menu_not_found';
  end if;
  select * into s from public.mess_settings where mess_id = v_menu.mess_id;

  v_is_manager := coalesce(private.managed_mess_id() = v_menu.mess_id, false);
  if v_target <> v_uid and not v_is_manager then
    raise exception 'not_manager';
  end if;
  if not private.is_active_member(v_menu.mess_id, v_target) then
    raise exception 'not_member';
  end if;
  if private.is_month_closed(v_menu.mess_id, v_menu.menu_date) then
    raise exception 'month_closed';
  end if;
  if not v_is_manager then
    if v_menu.is_locked then
      raise exception 'menu_locked';
    end if;
    if now() > v_menu.cutoff_at then
      raise exception 'cutoff_passed';
    end if;
  end if;
  if v_guests < 0 or v_guests > s.max_guests_per_meal then
    raise exception 'too_many_guests';
  end if;
  if v_guests > 0 and not s.guest_meal_allowed then
    raise exception 'guests_not_allowed';
  end if;

  v_units := case when p_ordered then 1 + v_guests else 0 end;

  select * into v_order from public.meal_orders where menu_id = p_menu_id and user_id = v_target for update;

  if s.meal_rate_mode = 'fixed' then
    v_new_cost := v_menu.price * v_units;
    v_delta := v_new_cost - coalesce(v_order.charged_amount, 0);
    if v_delta > 0 then
      v_balance := private.balance_of(v_menu.mess_id, v_target);
      if v_balance - v_delta < -s.credit_limit then
        raise exception 'insufficient_balance'
          using hint = 'Balance ' || v_balance || ', needed ' || v_delta;
      end if;
    end if;
  end if;

  if v_order.id is null then
    if not p_ordered then
      return jsonb_build_object('order_id', null, 'status', 'cancelled', 'guest_count', 0, 'charged_amount', 0);
    end if;
    insert into public.meal_orders (mess_id, menu_id, user_id, status, guest_count, charged_amount, ordered_by)
    values (v_menu.mess_id, p_menu_id, v_target, 'ordered', v_guests, v_new_cost, v_uid)
    returning * into v_order;
  else
    update public.meal_orders
       set status = case when p_ordered then 'ordered'::public.order_status else 'cancelled'::public.order_status end,
           guest_count = v_guests,
           charged_amount = v_new_cost,
           ordered_by = v_uid
     where id = v_order.id
     returning * into v_order;
  end if;

  if s.meal_rate_mode = 'fixed' and v_delta <> 0 then
    insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, period_month, ref_table, ref_id, created_by)
    values (v_menu.mess_id, v_target,
            case when v_delta > 0 then 'meal_charge'::public.ledger_type else 'meal_refund'::public.ledger_type end,
            -v_delta,
            case v_menu.slot when 'breakfast' then 'সকালের মিল' when 'lunch' then 'দুপুরের মিল' else 'রাতের মিল' end
              || ' · ' || to_char(v_menu.menu_date, 'DD Mon') || case when v_guests > 0 then ' (+' || v_guests || ' অতিথি)' else '' end,
            private.month_start(v_menu.menu_date), 'meal_orders', v_order.id, v_uid);
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'guest_count', v_order.guest_count,
    'charged_amount', v_order.charged_amount,
    'balance', private.balance_of(v_menu.mess_id, v_target));
end;
$$;

-- Meal units per member for a month (guests count as extra meals; slot weights
-- come from the mess settings).
create or replace function private.meal_units(p_mess uuid, p_month date)
returns table (user_id uuid, units numeric)
language sql stable security definer
set search_path = ''
as $$
  select o.user_id,
         sum((1 + o.guest_count) * case m.slot when 'breakfast' then s.breakfast_weight
                                               when 'lunch' then s.lunch_weight
                                               else s.dinner_weight end)::numeric as units
  from public.meal_orders o
  join public.menus m on m.id = o.menu_id
  join public.mess_settings s on s.mess_id = m.mess_id
  where m.mess_id = p_mess
    and o.status = 'ordered'
    and m.menu_date >= private.month_start(p_month)
    and m.menu_date < (private.month_start(p_month) + interval '1 month')::date
  group by o.user_id
$$;

-- Headcount per slot for a day (for the bua / kitchen list).
create or replace function public.get_meal_headcount(p_date date default null)
returns table (menu_id uuid, slot public.meal_slot, items text, members bigint, guests bigint, total bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_mess uuid := private.current_mess_id();
begin
  perform private.require_user();
  if v_mess is null then
    raise exception 'not_in_mess';
  end if;
  return query
    select m.id, m.slot, m.items,
           count(o.id) filter (where o.status = 'ordered'),
           coalesce(sum(o.guest_count) filter (where o.status = 'ordered'), 0)::bigint,
           (count(o.id) filter (where o.status = 'ordered')
             + coalesce(sum(o.guest_count) filter (where o.status = 'ordered'), 0))::bigint
    from public.menus m
    left join public.meal_orders o on o.menu_id = m.id
    where m.mess_id = v_mess and m.menu_date = coalesce(p_date, private.dhaka_today())
    group by m.id, m.slot, m.items
    order by m.slot;
end;
$$;
