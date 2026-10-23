-- =============================================================================
-- MessMate BD · 0001 · Foundation
-- Schemas, extensions, enums and small utility helpers used by every module.
--
-- Run the migrations in order (0001 → 0012) in the Supabase SQL editor, or paste
-- the bundled supabase/setup.sql once. 0013 (pg_cron) is run separately.
--
-- Conventions
--   * Every SECURITY DEFINER function pins `search_path = ''` and uses fully
--     qualified names, so it cannot be hijacked by objects in other schemas.
--   * RPCs raise short snake_case error keys (e.g. 'insufficient_balance');
--     the frontend maps them to Bangla / English messages.
--   * Money is numeric(12,2) in Taka. Dates use the Asia/Dhaka calendar.
-- =============================================================================

create schema if not exists private;
comment on schema private is 'MessMate internal helpers. Not exposed through the Data API.';
grant usage on schema private to anon, authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.platform_role     as enum ('user', 'landlord', 'service_provider', 'super_admin');
create type public.mess_role         as enum ('manager', 'member');
create type public.member_status     as enum ('pending', 'active', 'inactive', 'rejected', 'left');
create type public.occupation_type   as enum ('student', 'job_holder', 'business', 'other');
create type public.gender_type       as enum ('male', 'female', 'other');
create type public.room_type         as enum ('single', 'double', 'shared', 'seat');

create type public.meal_slot         as enum ('breakfast', 'lunch', 'dinner');
create type public.meal_rate_mode    as enum ('auto', 'fixed');
create type public.order_status      as enum ('ordered', 'cancelled');

create type public.ledger_type       as enum (
  'deposit',        -- money in (approved bKash/Nagad/Rocket/cash)
  'meal_charge',    -- meal cost (fixed price at order time, or meal-rate at month close)
  'meal_refund',    -- fixed-mode meal cancelled before cutoff
  'bill_share',     -- member share of a posted bill or shared expense
  'reimbursement',  -- member paid a mess expense from own pocket
  'adjustment',     -- manual correction by manager (signed)
  'refund_payout',  -- manager returned money to member (e.g. leaving the mess)
  'reversal'        -- exact negation of an earlier entry
);
create type public.payment_method    as enum ('bkash', 'nagad', 'rocket', 'cash', 'bank');
create type public.request_status    as enum ('pending', 'approved', 'rejected');
create type public.expense_category  as enum ('bazar', 'cooking_gas', 'utensils', 'cleaning', 'repair', 'other');
create type public.expense_payer     as enum ('mess_fund', 'member');
create type public.bill_type         as enum ('rent', 'electricity', 'gas', 'water', 'wifi', 'bua', 'service_charge', 'other');
create type public.split_mode        as enum ('equal', 'by_room', 'custom');
create type public.bill_status       as enum ('draft', 'posted', 'void');

create type public.listing_type      as enum ('seat', 'room', 'flat', 'sublet');
create type public.moderation_status as enum ('pending', 'approved', 'rejected', 'archived');
create type public.gender_pref       as enum ('male', 'female', 'any');
create type public.tenant_pref       as enum ('student', 'job_holder', 'any');
create type public.move_kind         as enum ('move_in', 'move_out');

create type public.complaint_category as enum ('bua', 'landlord', 'load_shedding', 'water', 'gas', 'wifi', 'noise', 'cleanliness', 'security', 'other');
create type public.complaint_status  as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.priority_level    as enum ('low', 'normal', 'high', 'urgent');
create type public.chore_type        as enum ('bazar', 'cleaning', 'cooking_help', 'garbage', 'water_filter', 'other');
create type public.chore_status      as enum ('pending', 'done', 'skipped');
create type public.service_category  as enum ('bua_cook', 'tiffin', 'electrician', 'plumber', 'gas_cylinder', 'internet', 'laundry', 'tutor', 'moving_van', 'doctor', 'other');
create type public.market_category   as enum ('furniture', 'bed', 'fan', 'electronics', 'books', 'kitchen', 'clothing', 'other');
create type public.item_condition    as enum ('new', 'like_new', 'good', 'fair');
create type public.market_status     as enum ('available', 'reserved', 'sold', 'removed');
create type public.place_kind        as enum ('hospital', 'pharmacy', 'police', 'fire_service', 'ambulance', 'blood_bank', 'helpline', 'mental_health');
create type public.budget_entry_type as enum ('income', 'expense');
create type public.budget_category   as enum ('food', 'rent', 'transport', 'mobile_internet', 'education', 'health', 'family', 'shopping', 'entertainment', 'savings', 'salary', 'tuition_income', 'other');

create type public.mood_level        as enum ('great', 'good', 'okay', 'tired', 'sad', 'stressed');
create type public.care_alert_type   as enum ('sick', 'sos');
create type public.care_alert_status as enum ('active', 'acknowledged', 'resolved');
create type public.checkin_status    as enum ('pending', 'arrived', 'overdue', 'cancelled');
create type public.reminder_type     as enum ('medicine', 'water', 'sleep', 'call_home', 'rent', 'bill', 'custom');
create type public.loan_direction    as enum ('lent', 'borrowed');
create type public.loan_status       as enum ('open', 'settled');
create type public.event_type        as enum ('iftar', 'eid', 'puja', 'meetup', 'sports', 'study', 'other');
create type public.job_type          as enum ('tuition', 'part_time', 'freelance', 'internship');
create type public.job_status        as enum ('open', 'closed', 'removed');
create type public.cook_equipment    as enum ('rice_cooker', 'stove', 'kettle', 'no_cook');
create type public.feedback_type     as enum ('feedback', 'bug', 'contact', 'report');
create type public.feedback_status   as enum ('new', 'reviewing', 'resolved');

-- -----------------------------------------------------------------------------
-- Utility helpers
-- -----------------------------------------------------------------------------

-- Today's date on the Dhaka calendar (the server runs in UTC).
create or replace function private.dhaka_today()
returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Dhaka')::date
$$;

-- First day of the month that contains p_date.
create or replace function private.month_start(p_date date)
returns date
language sql immutable
set search_path = ''
as $$
  select date_trunc('month', p_date::timestamp)::date
$$;

-- A Dhaka wall-clock date + time as an absolute timestamp.
create or replace function private.dhaka_ts(p_date date, p_time time)
returns timestamptz
language sql immutable
set search_path = ''
as $$
  select (p_date + p_time) at time zone 'Asia/Dhaka'
$$;

create or replace function private.try_uuid(p_text text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- True when the statement is not coming from an end user: SQL editor, pg_cron,
-- Supabase Auth internals. Requests through the Data API always run as
-- anon/authenticated via the `authenticator` login role.
create or replace function private.is_system_call()
returns boolean
language sql stable
set search_path = ''
as $$
  select auth.uid() is null
     and session_user::text <> 'authenticator'
     and coalesce(nullif(current_setting('role', true), ''), 'none') not in ('anon', 'authenticated', 'authenticator')
$$;

-- Transaction-local flag our own RPCs set before touching guarded columns.
-- End users cannot set it: the private schema is not exposed by the Data API.
create or replace function private.is_internal()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(current_setting('messmate.internal', true), '') = 'on'
$$;

create or replace function private.set_internal(p_on boolean)
returns void
language plpgsql volatile
set search_path = ''
as $$
begin
  perform set_config('messmate.internal', case when p_on then 'on' else 'off' end, true);
end;
$$;

-- Demo/data purge mode (used only by supabase/remove_demo.sql from the SQL editor).
create or replace function private.is_purge()
returns boolean
language sql stable
set search_path = ''
as $$
  select private.is_system_call() and coalesce(current_setting('messmate.purge', true), '') = 'on'
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 8-character invite code without look-alike characters (no 0/O, 1/I).
create or replace function private.new_invite_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function private.taka(p_amount numeric)
returns text
language sql immutable
set search_path = ''
as $$
  select '৳' || trim(to_char(round(p_amount, 2), 'FM999999999990.00'))
$$;
