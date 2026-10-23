-- =============================================================================
-- MessMate BD · 0005 · Expenses, bills, bill splitting, monthly closing
--
-- Expenses   bazar / cooking gas feed the meal rate; other categories are
--            "shared expenses" split equally at close (if enabled).
-- Bills      rent / utilities / bua salary, split equally, by room rent or
--            custom, posted as bill_share ledger entries.
-- Closing    computes the meal rate, posts meal + shared charges, writes one
--            statement per member and locks the month.
-- =============================================================================

create table public.expenses (
  id                      uuid primary key default gen_random_uuid(),
  mess_id                 uuid not null references public.messes (id) on delete cascade,
  category                public.expense_category not null default 'bazar',
  amount                  numeric(12,2) not null check (amount > 0 and amount <= 1000000),
  expense_date            date not null default private.dhaka_today(),
  description             text check (char_length(description) <= 300),
  receipt_path            text check (char_length(receipt_path) <= 300),
  paid_from               public.expense_payer not null default 'mess_fund',
  paid_by                 uuid references public.profiles (id) on delete restrict,
  reimbursement_entry_id  uuid references public.ledger_entries (id) on delete restrict,
  added_by                uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint expense_member_payer check (paid_from = 'mess_fund' or paid_by is not null)
);
create index expenses_mess_date_idx on public.expenses (mess_id, expense_date);

-- If a member paid from their own pocket, credit them right away
-- (reimbursement). Closed months are frozen.
create or replace function private.expense_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_entry uuid;
begin
  if private.is_purge() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if private.is_month_closed(old.mess_id, old.expense_date) then
      raise exception 'month_closed';
    end if;
    if old.reimbursement_entry_id is not null
       and not exists (select 1 from public.ledger_entries where reverses_id = old.reimbursement_entry_id) then
      insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, period_month, reverses_id, created_by)
      values (old.mess_id, old.paid_by, 'reversal', -old.amount, 'খরচ মুছে ফেলা হয়েছে · ফেরত বাতিল',
              private.month_start(old.expense_date), old.reimbursement_entry_id, auth.uid());
    end if;
    return old;
  end if;

  if private.is_month_closed(new.mess_id, new.expense_date) then
    raise exception 'month_closed';
  end if;
  if new.expense_date > private.dhaka_today() + 1 then
    raise exception 'future_date';
  end if;

  if tg_op = 'UPDATE' then
    if new.mess_id <> old.mess_id then
      raise exception 'expense_identity_locked';
    end if;
    if private.is_month_closed(old.mess_id, old.expense_date) then
      raise exception 'month_closed';
    end if;
    if new.paid_from is distinct from old.paid_from or new.paid_by is distinct from old.paid_by then
      raise exception 'expense_payer_locked';
    end if;
    if old.reimbursement_entry_id is not null
       and (new.amount <> old.amount or private.month_start(new.expense_date) <> private.month_start(old.expense_date)) then
      raise exception 'expense_reimbursed_locked';
    end if;
    new.reimbursement_entry_id := old.reimbursement_entry_id;
    new.added_by := old.added_by;
    return new;
  end if;

  -- INSERT
  new.added_by := coalesce(auth.uid(), new.added_by);
  new.reimbursement_entry_id := null;
  if new.paid_from = 'member' then
    if not exists (select 1 from public.mess_members
                   where mess_id = new.mess_id and user_id = new.paid_by and status in ('active', 'inactive')) then
      raise exception 'payer_not_member';
    end if;
    insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, period_month, ref_table, ref_id, created_by)
    values (new.mess_id, new.paid_by, 'reimbursement', new.amount,
            'নিজের টাকায় খরচ ফেরত · ' || coalesce(left(new.description, 60), new.category::text),
            private.month_start(new.expense_date), 'expenses', new.id, new.added_by)
    returning id into v_entry;
    new.reimbursement_entry_id := v_entry;
  end if;
  return new;
end;
$$;

create trigger expenses_guard before insert or update or delete on public.expenses
  for each row execute function private.expense_guard();
create trigger expenses_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Bills
-- -----------------------------------------------------------------------------
create table public.bills (
  id            uuid primary key default gen_random_uuid(),
  mess_id       uuid not null references public.messes (id) on delete cascade,
  bill_type     public.bill_type not null,
  period_month  date not null check (period_month = date_trunc('month', period_month::timestamp)::date),
  total_amount  numeric(12,2) not null check (total_amount >= 0 and total_amount <= 10000000),
  split_mode    public.split_mode not null default 'equal',
  due_date      date,
  description   text check (char_length(description) <= 300),
  status        public.bill_status not null default 'draft',
  posted_at     timestamptz,
  posted_by     uuid references public.profiles (id) on delete set null,
  voided_at     timestamptz,
  void_reason   text check (char_length(void_reason) <= 200),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index bills_mess_period_idx on public.bills (mess_id, period_month);

create table public.bill_shares (
  id               uuid primary key default gen_random_uuid(),
  bill_id          uuid not null references public.bills (id) on delete restrict,
  mess_id          uuid not null references public.messes (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  amount           numeric(12,2) not null check (amount >= 0),
  ledger_entry_id  uuid references public.ledger_entries (id) on delete restrict,
  created_at       timestamptz not null default now(),
  unique (bill_id, user_id)
);
create index bill_shares_user_idx on public.bill_shares (user_id);
create index bill_shares_mess_idx on public.bill_shares (mess_id);

-- Drafts are editable by managers; posting / voiding happens only via RPC.
create or replace function private.bill_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_purge() or private.is_internal() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'bill_not_draft';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.posted_at := null;
    new.posted_by := null;
    new.voided_at := null;
    new.void_reason := null;
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    if old.status <> 'draft' then
      raise exception 'bill_not_draft';
    end if;
    if new.status <> 'draft' then
      raise exception 'use_post_bill';
    end if;
    if new.mess_id <> old.mess_id then
      raise exception 'bill_identity_locked';
    end if;
  end if;

  if private.is_month_closed(new.mess_id, new.period_month) then
    raise exception 'month_closed';
  end if;
  return new;
end;
$$;

create trigger bills_guard before insert or update or delete on public.bills
  for each row execute function private.bill_guard();
create trigger bills_updated_at before update on public.bills
  for each row execute function private.set_updated_at();
create trigger bills_audit after insert or update or delete on public.bills
  for each row execute function private.audit_row();

create table public.member_statements (
  id               uuid primary key default gen_random_uuid(),
  closing_id       uuid not null references public.monthly_closings (id) on delete restrict,
  mess_id          uuid not null references public.messes (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  period_month     date not null,
  opening_balance  numeric(12,2) not null,
  deposits         numeric(12,2) not null,
  meal_units       numeric(10,2) not null,
  meal_cost        numeric(12,2) not null,
  bill_cost        numeric(12,2) not null,
  other_net        numeric(12,2) not null,
  closing_balance  numeric(12,2) not null,
  created_at       timestamptz not null default now(),
  unique (closing_id, user_id)
);
create index member_statements_user_idx on public.member_statements (user_id, period_month desc);
create index member_statements_mess_idx on public.member_statements (mess_id, period_month desc);

create trigger monthly_closings_audit after insert on public.monthly_closings
  for each row execute function private.audit_row();

-- Members who belonged to the mess at any point during the month.
create or replace function private.month_participants(p_mess uuid, p_month date)
returns table (user_id uuid, room_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select distinct on (mm.user_id) mm.user_id, mm.room_id
  from public.mess_members mm
  where mm.mess_id = p_mess
    and mm.status in ('active', 'inactive', 'left')
    and mm.joined_at is not null
    and mm.joined_at < private.dhaka_ts((private.month_start(p_month) + interval '1 month')::date, '00:00')
    and (mm.left_at is null or mm.left_at >= private.dhaka_ts(private.month_start(p_month), '00:00'))
  order by mm.user_id, mm.joined_at desc
$$;

create or replace function private.bill_label(p_type public.bill_type)
returns text
language sql immutable
set search_path = ''
as $$
  select case p_type
    when 'rent' then 'ভাড়া'
    when 'electricity' then 'বিদ্যুৎ বিল'
    when 'gas' then 'গ্যাস বিল'
    when 'water' then 'পানির বিল'
    when 'wifi' then 'ওয়াইফাই বিল'
    when 'bua' then 'বুয়ার বেতন'
    when 'service_charge' then 'সার্ভিস চার্জ'
    else 'অন্যান্য বিল'
  end
$$;

-- Post a draft bill: split it and charge every share to the ledger.
--   equal   : total split across the month's members (paisa remainder spread)
--   by_room : each room's monthly_rent split among its occupants; total becomes the sum
--   custom  : p_custom = [{"user_id": "...", "amount": 1200}, ...] must sum to total
create or replace function public.post_bill(p_bill_id uuid, p_custom jsonb default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_bill    public.bills%rowtype;
  v_users   uuid[];
  v_amounts numeric[];
  v_n       integer;
  v_cents   bigint;
  v_base    bigint;
  v_rem     integer;
  v_share   uuid;
  v_entry   uuid;
  v_total   numeric(12,2);
  v_label   text;
begin
  select * into v_bill from public.bills where id = p_bill_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if not private.is_system_call() and private.managed_mess_id() is distinct from v_bill.mess_id then
    raise exception 'not_manager';
  end if;
  if v_bill.status <> 'draft' then
    raise exception 'bill_not_draft';
  end if;
  if private.is_month_closed(v_bill.mess_id, v_bill.period_month) then
    raise exception 'month_closed';
  end if;

  if v_bill.split_mode = 'equal' then
    select array_agg(p.user_id order by p.user_id) into v_users
      from private.month_participants(v_bill.mess_id, v_bill.period_month) p;
    v_n := coalesce(cardinality(v_users), 0);
    if v_n = 0 then
      raise exception 'no_participants';
    end if;
    v_cents := round(v_bill.total_amount * 100);
    v_base := v_cents / v_n;
    v_rem := (v_cents - v_base * v_n)::integer;
    v_amounts := array[]::numeric[];
    for i in 1..v_n loop
      v_amounts := v_amounts || ((v_base + case when i <= v_rem then 1 else 0 end) / 100.0)::numeric;
    end loop;

  elsif v_bill.split_mode = 'by_room' then
    select array_agg(x.user_id order by x.user_id), array_agg(x.amount order by x.user_id)
      into v_users, v_amounts
      from (select p.user_id,
                   round(r.monthly_rent / count(*) over (partition by p.room_id), 2) as amount
              from private.month_participants(v_bill.mess_id, v_bill.period_month) p
              join public.mess_rooms r on r.id = p.room_id) x;
    v_n := coalesce(cardinality(v_users), 0);
    if v_n = 0 then
      raise exception 'no_participants';
    end if;

  else
    if p_custom is null or jsonb_typeof(p_custom) <> 'array' or jsonb_array_length(p_custom) = 0 then
      raise exception 'custom_split_required';
    end if;
    select array_agg(c.user_id order by c.user_id), array_agg(round(c.amount, 2) order by c.user_id)
      into v_users, v_amounts
      from jsonb_to_recordset(p_custom) as c(user_id uuid, amount numeric);
    v_n := cardinality(v_users);
    if (select count(distinct u) from unnest(v_users) u) <> v_n then
      raise exception 'custom_split_duplicate_user';
    end if;
    if exists (select 1 from unnest(v_amounts) a where a is null or a < 0) then
      raise exception 'invalid_amount';
    end if;
    if exists (select 1 from unnest(v_users) u
               where u is null or u not in (select p.user_id from private.month_participants(v_bill.mess_id, v_bill.period_month) p)) then
      raise exception 'custom_split_not_member';
    end if;
    if abs((select sum(a) from unnest(v_amounts) a) - v_bill.total_amount) >= 0.01 then
      raise exception 'custom_split_mismatch';
    end if;
  end if;

  v_label := private.bill_label(v_bill.bill_type) || ' · ' || to_char(v_bill.period_month, 'Mon YYYY');
  v_total := 0;
  for i in 1..v_n loop
    v_share := gen_random_uuid();
    v_entry := null;
    if v_amounts[i] > 0 then
      insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, period_month, ref_table, ref_id, created_by)
      values (v_bill.mess_id, v_users[i], 'bill_share', -v_amounts[i], v_label, v_bill.period_month, 'bill_shares', v_share, v_uid)
      returning id into v_entry;
    end if;
    insert into public.bill_shares (id, bill_id, mess_id, user_id, amount, ledger_entry_id)
    values (v_share, v_bill.id, v_bill.mess_id, v_users[i], v_amounts[i], v_entry);
    v_total := v_total + v_amounts[i];

    perform private.notify(v_users[i], v_bill.mess_id, 'bill_posted', 'নতুন বিল: ' || private.bill_label(v_bill.bill_type),
      'আপনার ভাগ ' || private.taka(v_amounts[i]) || ' (' || to_char(v_bill.period_month, 'Mon YYYY') || ')।',
      '/billing', jsonb_build_object('bill_id', v_bill.id, 'amount', v_amounts[i]));
  end loop;

  perform private.set_internal(true);
  update public.bills
     set status = 'posted', posted_at = now(), posted_by = v_uid,
         total_amount = case when v_bill.split_mode = 'by_room' then v_total else total_amount end
   where id = v_bill.id;
  perform private.set_internal(false);
  return v_n;
end;
$$;

create or replace function public.void_bill(p_bill_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_user();
  v_bill   public.bills%rowtype;
  v_reason text := left(nullif(trim(p_reason), ''), 200);
  r        record;
begin
  select * into v_bill from public.bills where id = p_bill_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if private.managed_mess_id() is distinct from v_bill.mess_id then
    raise exception 'not_manager';
  end if;
  if v_bill.status <> 'posted' then
    raise exception 'bill_not_posted';
  end if;
  if private.is_month_closed(v_bill.mess_id, v_bill.period_month) then
    raise exception 'month_closed';
  end if;
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;

  for r in select bs.user_id, l.id as entry_id, l.amount
             from public.bill_shares bs
             join public.ledger_entries l on l.id = bs.ledger_entry_id
            where bs.bill_id = v_bill.id loop
    insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, period_month, reverses_id, created_by)
    values (v_bill.mess_id, r.user_id, 'reversal', -r.amount, 'বিল বাতিল: ' || v_reason, v_bill.period_month, r.entry_id, v_uid);
    perform private.notify(r.user_id, v_bill.mess_id, 'bill_voided', 'বিল বাতিল হয়েছে: ' || private.bill_label(v_bill.bill_type),
      private.taka(-r.amount) || ' ফেরত দেওয়া হয়েছে। কারণ: ' || v_reason, '/billing');
  end loop;

  perform private.set_internal(true);
  update public.bills set status = 'void', voided_at = now(), void_reason = v_reason where id = v_bill.id;
  perform private.set_internal(false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Monthly closing
-- -----------------------------------------------------------------------------
create or replace function public.close_month(p_mess_id uuid, p_month date)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid            uuid := auth.uid();
  v_month          date := private.month_start(p_month);
  v_next           date := (private.month_start(p_month) + interval '1 month')::date;
  s                public.mess_settings%rowtype;
  v_closing        uuid := gen_random_uuid();
  v_meal_expense   numeric(12,2);
  v_shared_expense numeric(12,2);
  v_total_units    numeric(12,2);
  v_rate           numeric(12,4) := 0;
  v_users          uuid[];
  v_n              integer;
  v_cents          bigint;
  v_base           bigint;
  v_rem            integer;
  v_amount         numeric(12,2);
  v_bills          numeric(12,2);
  v_deposits       numeric(12,2);
  v_members        integer;
  r                record;
begin
  if not private.is_system_call() and private.managed_mess_id() is distinct from p_mess_id then
    raise exception 'not_manager';
  end if;
  if v_month >= private.month_start(private.dhaka_today()) then
    raise exception 'month_not_finished';
  end if;
  perform pg_advisory_xact_lock(hashtext('close_month:' || p_mess_id::text || ':' || v_month::text));
  if private.is_month_closed(p_mess_id, v_month) then
    raise exception 'month_already_closed';
  end if;
  select * into s from public.mess_settings where mess_id = p_mess_id;
  if not found then
    raise exception 'mess_settings_missing';
  end if;

  select coalesce(sum(e.amount) filter (where e.category in ('bazar', 'cooking_gas')), 0),
         coalesce(sum(e.amount) filter (where e.category not in ('bazar', 'cooking_gas')), 0)
    into v_meal_expense, v_shared_expense
    from public.expenses e
   where e.mess_id = p_mess_id and e.expense_date >= v_month and e.expense_date < v_next;

  select coalesce(sum(u.units), 0) into v_total_units from private.meal_units(p_mess_id, v_month) u;
  if v_total_units > 0 then
    v_rate := round(v_meal_expense / v_total_units, 4);
  end if;

  -- 1) auto mode: everyone pays their meal units × the month's meal rate
  if s.meal_rate_mode = 'auto' and v_rate > 0 then
    for r in select u.user_id, u.units from private.meal_units(p_mess_id, v_month) u where u.units > 0 loop
      v_amount := round(r.units * v_rate, 2);
      if v_amount > 0 then
        insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, period_month, ref_table, ref_id, created_by)
        values (p_mess_id, r.user_id, 'meal_charge', -v_amount,
                'মাসিক মিল খরচ · ' || trim(to_char(r.units, 'FM99990.##')) || ' মিল × ' || private.taka(v_rate),
                v_month, 'monthly_closings', v_closing, v_uid);
      end if;
    end loop;
  end if;

  -- 2) shared (non-meal) expenses split equally among the month's members
  if s.split_shared_expenses and v_shared_expense > 0 then
    select array_agg(p.user_id order by p.user_id) into v_users
      from private.month_participants(p_mess_id, v_month) p;
    v_n := coalesce(cardinality(v_users), 0);
    if v_n > 0 then
      v_cents := round(v_shared_expense * 100);
      v_base := v_cents / v_n;
      v_rem := (v_cents - v_base * v_n)::integer;
      for i in 1..v_n loop
        v_amount := (v_base + case when i <= v_rem then 1 else 0 end) / 100.0;
        if v_amount > 0 then
          insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, period_month, ref_table, ref_id, created_by)
          values (p_mess_id, v_users[i], 'bill_share', -v_amount, 'শেয়ার্ড খরচ (পরিষ্কার, মেরামত, অন্যান্য)',
                  v_month, 'monthly_closings', v_closing, v_uid);
        end if;
      end loop;
    end if;
  end if;

  select coalesce(sum(b.total_amount), 0) into v_bills
    from public.bills b where b.mess_id = p_mess_id and b.period_month = v_month and b.status = 'posted';
  select coalesce(sum(l.amount), 0) into v_deposits
    from public.ledger_entries l where l.mess_id = p_mess_id and l.period_month = v_month and l.entry_type = 'deposit';

  -- 3) lock the month (from here on the ledger rejects entries for it)
  insert into public.monthly_closings (id, mess_id, period_month, meal_rate_mode, total_meal_units, total_meal_expense,
                                       meal_rate, total_shared_expense, total_bills, total_deposits, closed_by)
  values (v_closing, p_mess_id, v_month, s.meal_rate_mode, v_total_units, v_meal_expense,
          v_rate, v_shared_expense, v_bills, v_deposits, v_uid);

  -- 4) one statement per member (participants + anyone with ledger activity)
  insert into public.member_statements (closing_id, mess_id, user_id, period_month, opening_balance, deposits,
                                        meal_units, meal_cost, bill_cost, other_net, closing_balance)
  select v_closing, p_mess_id, x.user_id, v_month,
         coalesce((select sum(lo.amount) from public.ledger_entries lo
                    where lo.mess_id = p_mess_id and lo.user_id = x.user_id and lo.period_month < v_month), 0),
         coalesce(sum(l.amount) filter (where l.entry_type = 'deposit'), 0),
         coalesce((select u.units from private.meal_units(p_mess_id, v_month) u where u.user_id = x.user_id), 0),
         -coalesce(sum(l.amount) filter (where l.entry_type in ('meal_charge', 'meal_refund')), 0),
         -coalesce(sum(l.amount) filter (where l.entry_type = 'bill_share'), 0),
         coalesce(sum(l.amount) filter (where l.entry_type in ('reimbursement', 'adjustment', 'refund_payout', 'reversal')), 0),
         0
    from (select p.user_id from private.month_participants(p_mess_id, v_month) p
          union
          select l2.user_id from public.ledger_entries l2
           where l2.mess_id = p_mess_id and l2.period_month = v_month) x
    left join public.ledger_entries l
      on l.mess_id = p_mess_id and l.user_id = x.user_id and l.period_month = v_month
   group by x.user_id;

  update public.member_statements
     set closing_balance = opening_balance + deposits - meal_cost - bill_cost + other_net
   where closing_id = v_closing;

  select count(*) into v_members from public.member_statements where closing_id = v_closing;
  update public.monthly_closings set member_count = v_members where id = v_closing;

  for r in select ms.user_id, ms.closing_balance from public.member_statements ms where ms.closing_id = v_closing loop
    perform private.notify(r.user_id, p_mess_id, 'month_closed',
      to_char(v_month, 'Mon YYYY') || ' মাসের হিসাব বন্ধ হয়েছে',
      'মিল রেট ' || private.taka(v_rate) || '। মাস শেষে আপনার ব্যালেন্স ' || private.taka(r.closing_balance) || '।',
      '/billing', jsonb_build_object('closing_id', v_closing, 'period_month', v_month));
  end loop;

  return v_closing;
end;
$$;

-- pg_cron: close last month for every mess with auto-close on, once the grace
-- days have passed. Failures are reported as warnings and retried next day.
create or replace function private.auto_close_due_months()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := private.dhaka_today();
  v_prev  date := (private.month_start(private.dhaka_today()) - interval '1 month')::date;
  v_count integer := 0;
  r       record;
begin
  for r in select m.id
             from public.messes m
             join public.mess_settings s on s.mess_id = m.id
            where m.is_active and s.auto_close_enabled
              and extract(day from v_today) >= s.auto_close_day
              and not private.is_month_closed(m.id, v_prev)
              and (exists (select 1 from public.menus mn where mn.mess_id = m.id
                            and mn.menu_date >= v_prev and mn.menu_date < private.month_start(v_today))
                   or exists (select 1 from public.ledger_entries l where l.mess_id = m.id and l.period_month = v_prev)
                   or exists (select 1 from public.expenses e where e.mess_id = m.id
                               and e.expense_date >= v_prev and e.expense_date < private.month_start(v_today))) loop
    begin
      perform public.close_month(r.id, v_prev);
      v_count := v_count + 1;
    exception when others then
      raise warning 'auto close failed for mess %: %', r.id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;
