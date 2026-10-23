-- =============================================================================
-- MessMate BD · 0017 · Admin dashboard, reports and activity log
-- Read-only RPCs behind the manager's reports / activity pages and the super
-- admin's mess and user directories. Nothing here changes data.
-- =============================================================================

-- Cursor pagination for one mess's activity log reads newest-first by id.
create index if not exists audit_logs_mess_id_idx on public.audit_logs (mess_id, id desc);

-- Escape a search term for ILIKE so % and _ are matched literally.
create or replace function private.like_pattern(p_text text)
returns text
language sql immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_') || '%'
$$;

-- Fields that changed between two row snapshots: {"field": [old, new]}.
create or replace function private.json_changes(p_old jsonb, p_new jsonb)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k.key, jsonb_build_array(p_old -> k.key, p_new -> k.key)), '{}'::jsonb)
  from (select jsonb_object_keys(coalesce(p_old, '{}'::jsonb) || coalesce(p_new, '{}'::jsonb)) as key) k
  where k.key not in ('updated_at')
    and (p_old -> k.key) is distinct from (p_new -> k.key)
$$;

-- -----------------------------------------------------------------------------
-- Activity log
--   Managers: their own mess only (p_mess_id may be omitted).
--   Super admins: any mess, or the whole platform when p_mess_id is null.
--   p_category narrows to money | members | spending | settings | moderation.
--   Pass the smallest id you have as p_before to load older entries.
-- -----------------------------------------------------------------------------
create or replace function public.get_activity_log(
  p_mess_id  uuid default null,
  p_category text default null,
  p_before   bigint default null,
  p_limit    integer default 40
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_mess   uuid := p_mess_id;
  v_limit  integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_tables text[];
begin
  perform private.require_user();
  if not private.is_super_admin() then
    v_mess := private.managed_mess_id();
    if v_mess is null or (p_mess_id is not null and p_mess_id <> v_mess) then
      raise exception 'not_manager';
    end if;
  end if;

  v_tables := case p_category
    when 'money'      then array['ledger_entries', 'deposit_requests']
    when 'members'    then array['mess_members']
    when 'spending'   then array['expenses', 'bills', 'monthly_closings']
    when 'settings'   then array['messes', 'mess_settings']
    when 'moderation' then array['listings']
  end;
  if p_category is not null and v_tables is null then
    raise exception 'invalid_input';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', a.id,
             'created_at', a.created_at,
             'action', a.action,
             'table', a.table_name,
             'record_id', a.record_id,
             'mess_id', a.mess_id,
             'mess_name', m.name,
             'actor_id', a.actor_id,
             'actor_name', nullif(ap.full_name, ''),
             'subject_id', s.subject,
             'subject_name', nullif(sp.full_name, ''),
             'data', coalesce(a.new_data, a.old_data),
             'changes', case when a.action = 'UPDATE' then private.json_changes(a.old_data, a.new_data) end)
           order by a.id desc), '[]'::jsonb)
      from (select x.*
              from public.audit_logs x
             where (v_mess is null or x.mess_id = v_mess)
               and (v_tables is null or x.table_name = any (v_tables))
               and (p_before is null or x.id < p_before)
             order by x.id desc
             limit v_limit) a
      left join public.messes m on m.id = a.mess_id
      left join public.profiles ap on ap.id = a.actor_id
      left join lateral (
        select private.try_uuid(coalesce(coalesce(a.new_data, a.old_data) ->> 'user_id',
                                         coalesce(a.new_data, a.old_data) ->> 'paid_by',
                                         coalesce(a.new_data, a.old_data) ->> 'owner_id')) as subject
      ) s on true
      left join public.profiles sp on sp.id = s.subject
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Mess report for one month (manager)
--   Closed month: the frozen member statements.
--   Open month: the same columns computed live; in auto mode the meal cost is
--   not charged yet, so est_meal_cost = units × the meal rate so far.
-- -----------------------------------------------------------------------------
create or replace function public.get_mess_report(p_month date default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_mess     uuid := private.managed_mess_id();
  v_month    date := private.month_start(coalesce(p_month, private.dhaka_today()));
  v_next     date := (private.month_start(coalesce(p_month, private.dhaka_today())) + interval '1 month')::date;
  s          public.mess_settings%rowtype;
  c          public.monthly_closings%rowtype;
  v_units    numeric;
  v_meal_exp numeric;
  v_rate     numeric;
begin
  perform private.require_user();
  if v_mess is null then
    raise exception 'not_manager';
  end if;
  select * into s from public.mess_settings where mess_id = v_mess;
  select * into c from public.monthly_closings where mess_id = v_mess and period_month = v_month;

  if c.id is not null then
    return jsonb_build_object(
      'month', v_month,
      'closed', true,
      'closed_at', c.closed_at,
      'estimated', false,
      'meal_rate_mode', c.meal_rate_mode,
      'meal_rate', c.meal_rate,
      'totals', jsonb_build_object(
         'meal_units', c.total_meal_units, 'meal_expense', c.total_meal_expense,
         'shared_expense', c.total_shared_expense, 'bills', c.total_bills, 'deposits', c.total_deposits),
      'members', (
         select coalesce(jsonb_agg(jsonb_build_object(
                  'user_id', st.user_id, 'full_name', p.full_name, 'phone', p.phone,
                  'room', mm.room_label, 'status', mm.status,
                  'opening', st.opening_balance, 'deposits', st.deposits, 'meal_units', st.meal_units,
                  'meal_cost', st.meal_cost, 'est_meal_cost', 0, 'bill_cost', st.bill_cost,
                  'other_net', st.other_net, 'closing', st.closing_balance,
                  'balance_now', (select coalesce(sum(l.amount), 0) from public.ledger_entries l
                                   where l.mess_id = v_mess and l.user_id = st.user_id))
                order by p.full_name), '[]'::jsonb)
           from public.member_statements st
           join public.profiles p on p.id = st.user_id
           left join lateral (select r.room_label, x.status
                                from public.mess_members x
                                left join public.mess_rooms r on r.id = x.room_id
                               where x.mess_id = v_mess and x.user_id = st.user_id
                               order by x.created_at desc limit 1) mm on true
          where st.closing_id = c.id));
  end if;

  select coalesce(sum(u.units), 0) into v_units from private.meal_units(v_mess, v_month) u;
  select coalesce(sum(e.amount), 0) into v_meal_exp
    from public.expenses e
   where e.mess_id = v_mess and e.category in ('bazar', 'cooking_gas')
     and e.expense_date >= v_month and e.expense_date < v_next;
  v_rate := case when v_units > 0 then round(v_meal_exp / v_units, 2) else 0 end;

  return jsonb_build_object(
    'month', v_month,
    'closed', false,
    'closed_at', null,
    'estimated', s.meal_rate_mode = 'auto',
    'meal_rate_mode', s.meal_rate_mode,
    'meal_rate', case when s.meal_rate_mode = 'auto' then v_rate end,
    'totals', jsonb_build_object(
       'meal_units', v_units,
       'meal_expense', v_meal_exp,
       'shared_expense', (select coalesce(sum(e.amount), 0) from public.expenses e
                           where e.mess_id = v_mess and e.category not in ('bazar', 'cooking_gas')
                             and e.expense_date >= v_month and e.expense_date < v_next),
       'bills', (select coalesce(sum(b.total_amount), 0) from public.bills b
                  where b.mess_id = v_mess and b.period_month = v_month and b.status = 'posted'),
       'deposits', (select coalesce(sum(l.amount), 0) from public.ledger_entries l
                     where l.mess_id = v_mess and l.period_month = v_month and l.entry_type = 'deposit')),
    'members', (
       select coalesce(jsonb_agg(jsonb_build_object(
                'user_id', r.user_id, 'full_name', p.full_name, 'phone', p.phone,
                'room', mm.room_label, 'status', mm.status,
                'opening', r.opening, 'deposits', r.deposits, 'meal_units', r.units,
                'meal_cost', r.meal_cost,
                'est_meal_cost', case when s.meal_rate_mode = 'auto' then round(r.units * v_rate, 2) else 0 end,
                'bill_cost', r.bill_cost, 'other_net', r.other_net,
                'closing', r.opening + r.deposits - r.meal_cost - r.bill_cost + r.other_net,
                'balance_now', r.balance_now)
              order by p.full_name), '[]'::jsonb)
         from (select x.user_id,
                      coalesce((select sum(lo.amount) from public.ledger_entries lo
                                 where lo.mess_id = v_mess and lo.user_id = x.user_id and lo.period_month < v_month), 0) as opening,
                      coalesce(sum(l.amount) filter (where l.entry_type = 'deposit'), 0) as deposits,
                      coalesce((select u.units from private.meal_units(v_mess, v_month) u where u.user_id = x.user_id), 0) as units,
                      -coalesce(sum(l.amount) filter (where l.entry_type in ('meal_charge', 'meal_refund')), 0) as meal_cost,
                      -coalesce(sum(l.amount) filter (where l.entry_type = 'bill_share'), 0) as bill_cost,
                      coalesce(sum(l.amount) filter (where l.entry_type in ('reimbursement', 'adjustment', 'refund_payout', 'reversal')), 0) as other_net,
                      coalesce((select sum(la.amount) from public.ledger_entries la
                                 where la.mess_id = v_mess and la.user_id = x.user_id), 0) as balance_now
                 from (select pt.user_id from private.month_participants(v_mess, v_month) pt
                       union
                       select l2.user_id from public.ledger_entries l2
                        where l2.mess_id = v_mess and l2.period_month = v_month) x
                 left join public.ledger_entries l
                   on l.mess_id = v_mess and l.user_id = x.user_id and l.period_month = v_month
                group by x.user_id) r
         join public.profiles p on p.id = r.user_id
         left join lateral (select rm.room_label, mx.status
                              from public.mess_members mx
                              left join public.mess_rooms rm on rm.id = mx.room_id
                             where mx.mess_id = v_mess and mx.user_id = r.user_id
                             order by mx.created_at desc limit 1) mm on true)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Super admin directories
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_messes(
  p_search text default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_q      text := nullif(trim(coalesce(p_search, '')), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform private.require_super_admin();
  return (
    with base as (
      select m.*
        from public.messes m
       where v_q is null
          or m.name ilike private.like_pattern(v_q)
          or m.address ilike private.like_pattern(v_q)
          or m.invite_code = upper(v_q)
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'rows', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.created_at desc)
          from (select b.id, b.name, b.address, b.is_active, b.invite_enabled, b.created_at,
                       a.name_bn as area_bn, a.name_en as area_en,
                       (select count(*) from public.mess_members mm
                         where mm.mess_id = b.id and mm.status = 'active') as active_members,
                       (select count(*) from public.mess_members mm
                         where mm.mess_id = b.id and mm.status = 'pending') as pending_members,
                       (select jsonb_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone, 'email', p.email)
                          from public.mess_members mm
                          join public.profiles p on p.id = mm.user_id
                         where mm.mess_id = b.id and mm.role = 'manager' and mm.status = 'active'
                         order by mm.joined_at nulls last
                         limit 1) as manager,
                       (select max(x.created_at) from public.audit_logs x where x.mess_id = b.id) as last_activity
                  from base b
                  left join public.areas a on a.id = b.area_id
                 order by b.created_at desc
                 limit v_limit offset v_offset) r), '[]'::jsonb))
  );
end;
$$;

create or replace function public.admin_list_users(
  p_search text default null,
  p_role   public.platform_role default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_q      text := nullif(trim(coalesce(p_search, '')), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform private.require_super_admin();
  return (
    with base as (
      select p.*
        from public.profiles p
       where (p_role is null or p.platform_role = p_role)
         and (v_q is null
              or p.full_name ilike private.like_pattern(v_q)
              or p.email ilike private.like_pattern(v_q)
              or p.phone like private.like_pattern(v_q))
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'rows', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.created_at desc)
          from (select b.id, b.full_name, b.email, b.phone, b.avatar_url, b.platform_role, b.occupation,
                       b.is_deleted, b.created_at,
                       mm.mess_id, mm.mess_name, mm.role as mess_role, mm.status as member_status
                  from base b
                  left join lateral (select x.mess_id, ms.name as mess_name, x.role, x.status
                                       from public.mess_members x
                                       join public.messes ms on ms.id = x.mess_id
                                      where x.user_id = b.id and x.status in ('pending', 'active', 'inactive')
                                      order by x.created_at desc
                                      limit 1) mm on true
                 order by b.created_at desc
                 limit v_limit offset v_offset) r), '[]'::jsonb))
  );
end;
$$;

-- Turn a mess off (no new joins, hidden from the platform counts) or back on.
create or replace function public.admin_set_mess_active(p_mess_id uuid, p_active boolean, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform private.require_super_admin();
  update public.messes
     set is_active = p_active,
         invite_enabled = case when p_active then invite_enabled else false end
   where id = p_mess_id
  returning name into v_name;
  if v_name is null then
    raise exception 'not_found';
  end if;
  perform private.notify(mm.user_id, p_mess_id, 'mess_status',
            case when p_active then 'মেস আবার চালু হয়েছে' else 'মেস সাময়িকভাবে বন্ধ করা হয়েছে' end,
            v_name || coalesce(' · ' || nullif(left(trim(p_reason), 300), ''), ''), null,
            jsonb_build_object('mess_id', p_mess_id, 'active', p_active))
    from public.mess_members mm
   where mm.mess_id = p_mess_id and mm.role = 'manager' and mm.status = 'active';
end;
$$;

-- Platform overview: same as 0009 plus English area names and the open
-- moderation / feedback workload in one place.
create or replace function public.get_platform_stats()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_super_admin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles where not is_deleted),
    'messes', (select count(*) from public.messes where is_active),
    'inactive_messes', (select count(*) from public.messes where not is_active),
    'active_members', (select count(*) from public.mess_members where status = 'active'),
    'listings', jsonb_build_object(
       'pending', (select count(*) from public.listings where status = 'pending'),
       'approved', (select count(*) from public.listings where status = 'approved')),
    'services_pending', (select count(*) from public.service_providers where status = 'pending'),
    'recipes_pending', (select count(*) from public.recipes where status = 'pending'),
    'events_pending', (select count(*) from public.community_events where status = 'pending'),
    'market_available', (select count(*) from public.market_items where status = 'available'),
    'upcoming_events', (select count(*) from public.community_events where status = 'approved' and starts_at > now()),
    'open_jobs', (select count(*) from public.job_posts where status = 'open'),
    'feedback_new', (select count(*) from public.feedback where status = 'new'),
    'signups_30d', (
       select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'count', coalesce(c.n, 0)) order by d), '[]'::jsonb)
         from generate_series((private.dhaka_today() - 29)::timestamp, private.dhaka_today()::timestamp, interval '1 day') d
         left join (select (created_at at time zone 'Asia/Dhaka')::date as day, count(*) as n
                      from public.profiles group by 1) c on c.day = d::date),
    'messes_by_area', (
       select coalesce(jsonb_agg(jsonb_build_object('area_bn', x.name_bn, 'area_en', x.name_en, 'count', x.n)
                                 order by x.n desc, x.name_en), '[]'::jsonb)
         from (select a.name_bn, a.name_en, count(*) as n
                 from public.messes m left join public.areas a on a.id = m.area_id
                where m.is_active group by 1, 2 order by 3 desc limit 10) x)
  );
end;
$$;

revoke execute on function public.get_activity_log(uuid, text, bigint, integer) from public, anon;
revoke execute on function public.get_mess_report(date) from public, anon;
revoke execute on function public.admin_list_messes(text, integer, integer) from public, anon;
revoke execute on function public.admin_list_users(text, public.platform_role, integer, integer) from public, anon;
revoke execute on function public.admin_set_mess_active(uuid, boolean, text) from public, anon;
grant execute on function public.get_activity_log(uuid, text, bigint, integer) to authenticated, service_role;
grant execute on function public.get_mess_report(date) to authenticated, service_role;
grant execute on function public.admin_list_messes(text, integer, integer) to authenticated, service_role;
grant execute on function public.admin_list_users(text, public.platform_role, integer, integer) to authenticated, service_role;
grant execute on function public.admin_set_mess_active(uuid, boolean, text) to authenticated, service_role;
