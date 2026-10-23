-- =============================================================================
-- MessMate BD · 0003 · Wallet (immutable ledger) + month locks + deposits
--
-- A member's balance is ALWAYS sum(ledger_entries.amount). Entries are never
-- edited or deleted: mistakes are fixed with a reversal entry. Positive amount =
-- money credited to the member, negative = money charged.
--
-- The app does not move real money. Members pay the manager by bKash / Nagad /
-- Rocket / cash and submit the TrxID; the manager confirms it by hand.
-- =============================================================================

-- Month closings lock a period: no ledger entry, menu, order, expense or bill can
-- be added to a closed month. (Closing logic lives in 0005.)
create table public.monthly_closings (
  id                    uuid primary key default gen_random_uuid(),
  mess_id               uuid not null references public.messes (id) on delete cascade,
  period_month          date not null check (period_month = date_trunc('month', period_month::timestamp)::date),
  meal_rate_mode        public.meal_rate_mode not null,
  total_meal_units      numeric(12,2) not null default 0,
  total_meal_expense    numeric(12,2) not null default 0,
  meal_rate             numeric(12,4) not null default 0,
  total_shared_expense  numeric(12,2) not null default 0,
  total_bills           numeric(12,2) not null default 0,
  total_deposits        numeric(12,2) not null default 0,
  member_count          integer not null default 0,
  closed_by             uuid references public.profiles (id) on delete set null,
  closed_at             timestamptz not null default now(),
  notes                 text check (char_length(notes) <= 500),
  unique (mess_id, period_month)
);

create or replace function private.is_month_closed(p_mess uuid, p_date date)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.monthly_closings c
    where c.mess_id = p_mess and c.period_month = private.month_start(p_date)
  )
$$;

-- -----------------------------------------------------------------------------
-- Ledger
-- -----------------------------------------------------------------------------
create table public.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  mess_id       uuid not null references public.messes (id) on delete restrict,
  user_id       uuid not null references public.profiles (id) on delete restrict,
  entry_type    public.ledger_type not null,
  amount        numeric(12,2) not null check (amount <> 0 and abs(amount) <= 10000000),
  description   text check (char_length(description) <= 200),
  period_month  date not null default private.month_start(private.dhaka_today())
                check (period_month = date_trunc('month', period_month::timestamp)::date),
  ref_table     text check (ref_table in ('deposit_requests', 'meal_orders', 'bill_shares', 'expenses', 'monthly_closings')),
  ref_id        uuid,
  reverses_id   uuid unique references public.ledger_entries (id) on delete restrict,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint ledger_sign_matches_type check (
       (entry_type in ('deposit', 'meal_refund', 'reimbursement') and amount > 0)
    or (entry_type in ('meal_charge', 'bill_share', 'refund_payout') and amount < 0)
    or (entry_type in ('adjustment', 'reversal'))
  ),
  constraint ledger_reversal_link check ((entry_type = 'reversal') = (reverses_id is not null))
);
create index ledger_mess_user_period_idx on public.ledger_entries (mess_id, user_id, period_month);
create index ledger_mess_period_idx on public.ledger_entries (mess_id, period_month, entry_type);
create index ledger_user_idx on public.ledger_entries (user_id, created_at desc);
create index ledger_ref_idx on public.ledger_entries (ref_table, ref_id);

-- Append-only: block UPDATE / DELETE, and block inserts into a closed month.
create or replace function private.ledger_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if private.is_month_closed(new.mess_id, new.period_month) then
      raise exception 'month_closed';
    end if;
    return new;
  end if;

  if private.is_purge() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'ledger_immutable' using hint = 'Ledger entries cannot be changed. Post a reversal instead.';
end;
$$;

create trigger ledger_entries_guard
  before insert or update or delete on public.ledger_entries
  for each row execute function private.ledger_guard();

-- Low-balance alert when a charge pushes the balance below the mess threshold.
create or replace function private.ledger_low_balance()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_threshold numeric;
  v_balance numeric;
begin
  if new.amount >= 0 then
    return null;
  end if;
  select s.low_balance_threshold into v_threshold from public.mess_settings s where s.mess_id = new.mess_id;
  if coalesce(v_threshold, 0) = 0 then
    return null;
  end if;
  select coalesce(sum(l.amount), 0) into v_balance
    from public.ledger_entries l where l.mess_id = new.mess_id and l.user_id = new.user_id;
  if v_balance < v_threshold and v_balance - new.amount >= v_threshold then
    perform private.notify(new.user_id, new.mess_id, 'low_balance', 'ব্যালেন্স কমে গেছে',
      'আপনার বর্তমান ব্যালেন্স ' || private.taka(v_balance) || '। মিল চালু রাখতে টাকা যোগ করুন।',
      '/wallet', jsonb_build_object('balance', v_balance, 'threshold', v_threshold));
  end if;
  return null;
end;
$$;

create trigger ledger_entries_low_balance
  after insert on public.ledger_entries
  for each row execute function private.ledger_low_balance();

create trigger ledger_entries_audit
  after insert on public.ledger_entries
  for each row execute function private.audit_row();

-- Balances (security_invoker: the caller's RLS applies — members see their own
-- row, managers see every member of their mess).
create view public.member_balances
with (security_invoker = true)
as
select l.mess_id,
       l.user_id,
       sum(l.amount)                                                        as balance,
       coalesce(sum(l.amount) filter (where l.entry_type = 'deposit'), 0)    as total_deposits,
       coalesce(sum(l.amount) filter (where l.entry_type = 'deposit'), 0) - sum(l.amount) as total_spent,
       max(l.created_at)                                                    as last_activity_at
from public.ledger_entries l
group by l.mess_id, l.user_id;

create or replace function private.balance_of(p_mess uuid, p_user uuid)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(l.amount), 0)::numeric
  from public.ledger_entries l
  where l.mess_id = p_mess and l.user_id = p_user
$$;

-- -----------------------------------------------------------------------------
-- Deposit requests (manual TrxID verification)
-- -----------------------------------------------------------------------------
create table public.deposit_requests (
  id               uuid primary key default gen_random_uuid(),
  mess_id          uuid not null references public.messes (id) on delete restrict,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  amount           numeric(12,2) not null check (amount >= 10 and amount <= 100000),
  method           public.payment_method not null,
  trx_id           text check (trx_id ~ '^[A-Z0-9]{6,20}$'),
  sender_number    text check (sender_number ~ '^\+?[0-9]{10,14}$'),
  paid_at          timestamptz,
  note             text check (char_length(note) <= 300),
  proof_path       text check (char_length(proof_path) <= 300),
  status           public.request_status not null default 'pending',
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text check (char_length(review_note) <= 300),
  ledger_entry_id  uuid references public.ledger_entries (id) on delete restrict,
  created_at       timestamptz not null default now(),
  constraint deposit_trx_required check (method = 'cash' or trx_id is not null),
  constraint deposit_approved_has_entry check (status <> 'approved' or ledger_entry_id is not null)
);
-- The same transaction ID cannot be claimed twice in one mess (unless rejected).
create unique index deposit_requests_trx_unique on public.deposit_requests (mess_id, method, trx_id)
  where trx_id is not null and status <> 'rejected';
create index deposit_requests_mess_status_idx on public.deposit_requests (mess_id, status, created_at desc);
create index deposit_requests_user_idx on public.deposit_requests (user_id, created_at desc);

create trigger deposit_requests_audit
  after insert or update on public.deposit_requests
  for each row execute function private.audit_row();

-- Member submits "I sent ৳X by bKash, TrxID ABC123".
create or replace function public.submit_deposit(
  p_amount        numeric,
  p_method        public.payment_method,
  p_trx_id        text default null,
  p_sender_number text default null,
  p_paid_at       timestamptz default null,
  p_note          text default null,
  p_proof_path    text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_mess uuid := private.current_mess_id();
  v_trx  text := nullif(upper(regexp_replace(coalesce(p_trx_id, ''), '\s', '', 'g')), '');
  v_id   uuid;
begin
  if v_mess is null then
    raise exception 'not_in_mess';
  end if;
  perform private.check_rate_limit('deposit:' || v_uid, 6, interval '1 hour');

  if p_amount is null or p_amount < 10 or p_amount > 100000 then
    raise exception 'invalid_amount';
  end if;
  if p_method <> 'cash' and v_trx is null then
    raise exception 'trx_id_required';
  end if;
  if v_trx is not null and v_trx !~ '^[A-Z0-9]{6,20}$' then
    raise exception 'invalid_trx_id';
  end if;
  if v_trx is not null and exists (
       select 1 from public.deposit_requests
       where mess_id = v_mess and method = p_method and trx_id = v_trx and status <> 'rejected') then
    raise exception 'duplicate_trx_id';
  end if;
  if p_proof_path is not null and p_proof_path not like v_mess::text || '/' || v_uid::text || '/%' then
    raise exception 'invalid_proof_path';
  end if;

  insert into public.deposit_requests (mess_id, user_id, amount, method, trx_id, sender_number, paid_at, note, proof_path)
  values (v_mess, v_uid, round(p_amount, 2), p_method, v_trx,
          nullif(regexp_replace(coalesce(p_sender_number, ''), '[\s-]', '', 'g'), ''),
          coalesce(p_paid_at, now()), left(nullif(trim(p_note), ''), 300), p_proof_path)
  returning id into v_id;

  perform private.notify_managers(v_mess, 'deposit_submitted', 'নতুন টাকা জমার অনুরোধ',
    private.display_name(v_uid) || ' ' || private.taka(p_amount) || ' জমা দিয়েছেন (' || p_method::text
      || coalesce(' · ' || v_trx, '') || ')। যাচাই করে অনুমোদন দিন।',
    '/manage/approvals', jsonb_build_object('request_id', v_id, 'amount', p_amount));
  return v_id;
end;
$$;

-- Manager approves (posts a ledger deposit) or rejects a request.
create or replace function public.review_deposit(p_request_id uuid, p_approve boolean, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_req   public.deposit_requests%rowtype;
  v_entry uuid;
begin
  select * into v_req from public.deposit_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if private.managed_mess_id() is distinct from v_req.mess_id then
    raise exception 'not_manager';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  if p_approve then
    insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, ref_table, ref_id, created_by)
    values (v_req.mess_id, v_req.user_id, 'deposit', v_req.amount,
            'জমা · ' || v_req.method::text || coalesce(' · ' || v_req.trx_id, ''),
            'deposit_requests', v_req.id, v_uid)
    returning id into v_entry;

    update public.deposit_requests
       set status = 'approved', reviewed_by = v_uid, reviewed_at = now(),
           review_note = left(nullif(trim(p_note), ''), 300), ledger_entry_id = v_entry
     where id = v_req.id;

    perform private.notify(v_req.user_id, v_req.mess_id, 'deposit_approved', 'টাকা জমা হয়েছে',
      private.taka(v_req.amount) || ' আপনার ওয়ালেটে যোগ হয়েছে। নতুন ব্যালেন্স '
        || private.taka(private.balance_of(v_req.mess_id, v_req.user_id)) || '।',
      '/wallet', jsonb_build_object('request_id', v_req.id, 'amount', v_req.amount));
  else
    update public.deposit_requests
       set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(),
           review_note = left(nullif(trim(p_note), ''), 300)
     where id = v_req.id;

    perform private.notify(v_req.user_id, v_req.mess_id, 'deposit_rejected', 'টাকা জমার অনুরোধ বাতিল',
      coalesce(nullif(trim(p_note), ''), 'TrxID বা পরিমাণ মেলেনি। ম্যানেজারের সাথে কথা বলুন।'),
      '/wallet', jsonb_build_object('request_id', v_req.id));
  end if;
  return v_entry;
end;
$$;

-- Manager-only entries: cash received in hand, corrections, refunds paid out.
create or replace function public.manager_ledger_entry(
  p_user_id uuid,
  p_type    public.ledger_type,
  p_amount  numeric,
  p_note    text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_user();
  v_mess   uuid := private.managed_mess_id();
  v_amount numeric(12,2);
  v_entry  uuid;
  v_req    uuid;
  v_note   text := left(nullif(trim(p_note), ''), 200);
begin
  if v_mess is null then
    raise exception 'not_manager';
  end if;
  if not exists (select 1 from public.mess_members
                 where mess_id = v_mess and user_id = p_user_id and status in ('active', 'inactive', 'left')) then
    raise exception 'not_member';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000 then
    raise exception 'invalid_amount';
  end if;

  case p_type
    when 'deposit' then
      if p_amount < 0 then raise exception 'invalid_amount'; end if;
      v_amount := round(p_amount, 2);
    when 'refund_payout' then
      v_amount := -round(abs(p_amount), 2);
    when 'adjustment' then
      if v_note is null or char_length(v_note) < 3 then raise exception 'reason_required'; end if;
      v_amount := round(p_amount, 2);
    else
      raise exception 'invalid_type';
  end case;

  if p_type = 'deposit' then
    -- keep the member's deposit history complete: record it as an approved cash request
    insert into public.deposit_requests (mess_id, user_id, amount, method, note, status, reviewed_by, reviewed_at, paid_at, ledger_entry_id)
    values (v_mess, p_user_id, v_amount, 'cash', v_note, 'pending', v_uid, now(), now(), null)
    returning id into v_req;
  end if;

  insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, ref_table, ref_id, created_by)
  values (v_mess, p_user_id, p_type, v_amount,
          coalesce(v_note, case p_type when 'deposit' then 'নগদ জমা' when 'refund_payout' then 'টাকা ফেরত' else 'সমন্বয়' end),
          case when v_req is not null then 'deposit_requests' end, v_req, v_uid)
  returning id into v_entry;

  if v_req is not null then
    update public.deposit_requests set status = 'approved', ledger_entry_id = v_entry where id = v_req;
  end if;

  perform private.notify(p_user_id, v_mess, 'ledger_' || p_type::text,
    case p_type when 'deposit' then 'নগদ টাকা জমা হয়েছে'
                when 'refund_payout' then 'টাকা ফেরত দেওয়া হয়েছে'
                else 'হিসাবে সমন্বয় করা হয়েছে' end,
    private.taka(v_amount) || coalesce(' · ' || v_note, ''), '/wallet',
    jsonb_build_object('entry_id', v_entry, 'amount', v_amount));
  return v_entry;
end;
$$;

-- Undo a deposit / adjustment / payout / reimbursement by posting its negation.
create or replace function public.reverse_ledger_entry(p_entry_id uuid, p_reason text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_user();
  v_entry  public.ledger_entries%rowtype;
  v_reason text := left(nullif(trim(p_reason), ''), 150);
  v_new    uuid;
begin
  select * into v_entry from public.ledger_entries where id = p_entry_id;
  if not found then
    raise exception 'not_found';
  end if;
  if private.managed_mess_id() is distinct from v_entry.mess_id then
    raise exception 'not_manager';
  end if;
  if v_entry.entry_type not in ('deposit', 'adjustment', 'refund_payout', 'reimbursement') then
    raise exception 'not_reversible';
  end if;
  if exists (select 1 from public.ledger_entries where reverses_id = v_entry.id) then
    raise exception 'already_reversed';
  end if;
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;

  insert into public.ledger_entries (mess_id, user_id, entry_type, amount, description, reverses_id, created_by)
  values (v_entry.mess_id, v_entry.user_id, 'reversal', -v_entry.amount, 'বাতিল: ' || v_reason, v_entry.id, v_uid)
  returning id into v_new;

  perform private.notify(v_entry.user_id, v_entry.mess_id, 'ledger_reversal', 'একটি লেনদেন বাতিল করা হয়েছে',
    private.taka(-v_entry.amount) || ' · ' || v_reason, '/wallet', jsonb_build_object('entry_id', v_new));
  return v_new;
end;
$$;

create or replace function public.get_wallet_summary(p_user_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_user();
  v_mess   uuid := private.current_mess_id();
  v_target uuid := coalesce(p_user_id, v_uid);
  v_result jsonb;
begin
  if v_mess is null then
    raise exception 'not_in_mess';
  end if;
  if v_target <> v_uid and private.managed_mess_id() is distinct from v_mess then
    raise exception 'not_manager';
  end if;

  select jsonb_build_object(
           'balance',        coalesce(sum(l.amount), 0),
           'total_deposits', coalesce(sum(l.amount) filter (where l.entry_type = 'deposit'), 0),
           'total_spent',    coalesce(sum(l.amount) filter (where l.entry_type = 'deposit'), 0) - coalesce(sum(l.amount), 0),
           'pending_count',  (select count(*) from public.deposit_requests d
                               where d.mess_id = v_mess and d.user_id = v_target and d.status = 'pending'),
           'pending_amount', (select coalesce(sum(d.amount), 0) from public.deposit_requests d
                               where d.mess_id = v_mess and d.user_id = v_target and d.status = 'pending'))
    into v_result
    from public.ledger_entries l
   where l.mess_id = v_mess and l.user_id = v_target;
  return v_result;
end;
$$;
