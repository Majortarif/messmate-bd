-- =============================================================================
-- MessMate BD · 0009 · Dashboards, reports, moderation, account data,
-- scheduled jobs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Who am I? Profile + open membership in one call (used by every app page).
-- Security definer so a pending applicant still sees the name of the mess they
-- applied to (they can't read `messes` through RLS yet).
-- -----------------------------------------------------------------------------
create or replace function public.get_my_context()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  return jsonb_build_object(
    'profile', (select jsonb_build_object(
                  'full_name', p.full_name, 'email', p.email, 'phone', p.phone, 'avatar_url', p.avatar_url,
                  'platform_role', p.platform_role, 'preferred_locale', p.preferred_locale,
                  'terms_accepted', p.terms_accepted_at is not null, 'is_deleted', p.is_deleted)
                  from public.profiles p where p.id = v_uid),
    'membership', (select jsonb_build_object(
                     'id', mm.id, 'mess_id', mm.mess_id, 'mess_name', m.name, 'role', mm.role,
                     'status', mm.status, 'requested_at', mm.created_at)
                     from public.mess_members mm join public.messes m on m.id = mm.mess_id
                    where mm.user_id = v_uid and mm.status in ('pending', 'active', 'inactive'))
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Member dashboard (one round trip for the home screen)
-- -----------------------------------------------------------------------------
create or replace function public.get_member_dashboard(p_month date default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid          uuid := private.require_user();
  v_mess         uuid := private.current_mess_id();
  v_today        date := private.dhaka_today();
  v_month        date := private.month_start(coalesce(p_month, private.dhaka_today()));
  v_next         date := (private.month_start(coalesce(p_month, private.dhaka_today())) + interval '1 month')::date;
  s              public.mess_settings%rowtype;
  v_member       public.mess_members%rowtype;
  v_closing      public.monthly_closings%rowtype;
  v_wallet       jsonb;
  v_balance      numeric;
  v_my_units     numeric := 0;
  v_total_units  numeric := 0;
  v_meal_expense numeric := 0;
  v_rate         numeric := 0;
  v_my_cost      numeric := 0;
  v_estimate     boolean;
begin
  if v_mess is null then
    return jsonb_build_object(
      'has_mess', false,
      'pending_request', (select jsonb_build_object('membership_id', mm.id, 'mess_name', m.name, 'requested_at', mm.created_at)
                            from public.mess_members mm join public.messes m on m.id = mm.mess_id
                           where mm.user_id = v_uid and mm.status = 'pending'),
      'unread_notifications', (select count(*) from public.notifications n where n.user_id = v_uid and n.read_at is null));
  end if;

  select * into s from public.mess_settings where mess_id = v_mess;
  select * into v_member from public.mess_members
   where mess_id = v_mess and user_id = v_uid and status in ('active', 'inactive');
  select * into v_closing from public.monthly_closings where mess_id = v_mess and period_month = v_month;

  select coalesce(sum(u.units), 0), coalesce(sum(u.units) filter (where u.user_id = v_uid), 0)
    into v_total_units, v_my_units
    from private.meal_units(v_mess, v_month) u;
  select coalesce(sum(e.amount), 0) into v_meal_expense
    from public.expenses e
   where e.mess_id = v_mess and e.category in ('bazar', 'cooking_gas')
     and e.expense_date >= v_month and e.expense_date < v_next;

  v_estimate := s.meal_rate_mode = 'auto' and v_closing.id is null;
  v_rate := case when v_closing.id is not null then v_closing.meal_rate
                 when v_total_units > 0 then round(v_meal_expense / v_total_units, 2)
                 else 0 end;
  if v_estimate then
    v_my_cost := round(v_my_units * v_rate, 2);
  else
    select -coalesce(sum(l.amount), 0) into v_my_cost
      from public.ledger_entries l
     where l.mess_id = v_mess and l.user_id = v_uid and l.period_month = v_month
       and l.entry_type in ('meal_charge', 'meal_refund');
  end if;

  select jsonb_build_object(
           'balance', coalesce(sum(l.amount), 0),
           'total_deposits', coalesce(sum(l.amount) filter (where l.entry_type = 'deposit'), 0),
           'total_spent', coalesce(sum(l.amount) filter (where l.entry_type = 'deposit'), 0) - coalesce(sum(l.amount), 0)),
         coalesce(sum(l.amount), 0)
    into v_wallet, v_balance
    from public.ledger_entries l where l.mess_id = v_mess and l.user_id = v_uid;

  return jsonb_build_object(
    'has_mess', true,
    'today', v_today,
    'month', v_month,
    'month_closed', v_closing.id is not null,
    'mess', (select jsonb_build_object('id', m.id, 'name', m.name, 'address', m.address,
                                       'area_bn', a.name_bn, 'area_en', a.name_en,
                                       'invite_code', case when v_member.role = 'manager' then m.invite_code end)
               from public.messes m left join public.areas a on a.id = m.area_id where m.id = v_mess),
    'membership', jsonb_build_object(
       'id', v_member.id, 'role', v_member.role, 'status', v_member.status,
       'joined_at', v_member.joined_at, 'seat', v_member.seat_label,
       'room', (select jsonb_build_object('label', r.room_label, 'flat', r.flat, 'building', r.building, 'type', r.room_type)
                  from public.mess_rooms r where r.id = v_member.room_id)),
    'settings', jsonb_build_object(
       'meal_rate_mode', s.meal_rate_mode, 'low_balance_threshold', s.low_balance_threshold,
       'guest_meal_allowed', s.guest_meal_allowed, 'max_guests_per_meal', s.max_guests_per_meal,
       'credit_limit', s.credit_limit),
    'wallet', v_wallet || jsonb_build_object(
       'pending_count', (select count(*) from public.deposit_requests d
                          where d.mess_id = v_mess and d.user_id = v_uid and d.status = 'pending'),
       'pending_amount', (select coalesce(sum(d.amount), 0) from public.deposit_requests d
                           where d.mess_id = v_mess and d.user_id = v_uid and d.status = 'pending'),
       'estimated_balance', case when v_estimate then v_balance - v_my_cost else v_balance end,
       'is_low', v_balance < s.low_balance_threshold),
    'meals', jsonb_build_object(
       'my_units', v_my_units, 'my_meal_cost', v_my_cost, 'meal_rate', v_rate, 'is_estimate', v_estimate,
       'mess_total_units', v_total_units, 'mess_meal_expense', v_meal_expense),
    'upcoming_menus', (
       select coalesce(jsonb_agg(jsonb_build_object(
                'menu_id', m.id, 'date', m.menu_date, 'slot', m.slot, 'items', m.items, 'price', m.price,
                'cutoff_at', m.cutoff_at, 'is_open', (not m.is_locked and now() <= m.cutoff_at),
                'my_status', o.status, 'my_guests', coalesce(o.guest_count, 0))
              order by m.menu_date, m.slot), '[]'::jsonb)
         from public.menus m
         left join public.meal_orders o on o.menu_id = m.id and o.user_id = v_uid
        where m.mess_id = v_mess and m.menu_date between v_today and v_today + 1),
    'notices', (
       select coalesce(jsonb_agg(to_jsonb(x) order by x.is_pinned desc, x.created_at desc), '[]'::jsonb)
         from (select n.id, n.title, n.priority, n.is_pinned, n.created_at
                 from public.notices n
                where n.mess_id = v_mess and (n.expires_at is null or n.expires_at > now())
                order by n.is_pinned desc, n.created_at desc limit 3) x),
    'my_chores', (
       select coalesce(jsonb_agg(to_jsonb(x) order by x.due_date), '[]'::jsonb)
         from (select c.id, c.title, c.chore_type, c.due_date, c.status
                 from public.chores c
                where c.mess_id = v_mess and c.assigned_to = v_uid and c.status = 'pending'
                  and c.due_date between v_today and v_today + 7
                order by c.due_date limit 5) x),
    'recent_transactions', (
       select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
         from (select l.id, l.entry_type, l.amount, l.description, l.created_at
                 from public.ledger_entries l
                where l.mess_id = v_mess and l.user_id = v_uid
                order by l.created_at desc limit 6) x),
    'unread_notifications', (select count(*) from public.notifications n where n.user_id = v_uid and n.read_at is null),
    'care', jsonb_build_object(
       'mood_today', (select mc.mood from public.mood_checkins mc where mc.user_id = v_uid and mc.checkin_date = v_today),
       'active_checkin', (select jsonb_build_object('id', sc.id, 'label', sc.label, 'expected_by', sc.expected_by, 'status', sc.status)
                            from public.safety_checkins sc
                           where sc.user_id = v_uid and sc.status in ('pending', 'overdue')
                           order by sc.created_at desc limit 1),
       'water_today', (select jsonb_build_object('glasses', w.glasses, 'goal', w.goal)
                         from public.water_logs w where w.user_id = v_uid and w.log_date = v_today),
       'last_family_call', (select max(f.called_at) from public.family_call_logs f where f.user_id = v_uid),
       'open_alerts_for_me', (select count(*) from public.care_alert_recipients r
                                join public.care_alerts a on a.id = r.alert_id
                               where r.user_id = v_uid and a.status <> 'resolved' and r.responded_at is null))
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Manager dashboard (charts + approvals)
-- -----------------------------------------------------------------------------
create or replace function public.get_manager_dashboard(p_month date default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_mess     uuid := private.managed_mess_id();
  v_today    date := private.dhaka_today();
  v_month    date := private.month_start(coalesce(p_month, private.dhaka_today()));
  v_next     date := (private.month_start(coalesce(p_month, private.dhaka_today())) + interval '1 month')::date;
  s          public.mess_settings%rowtype;
  v_closing  public.monthly_closings%rowtype;
  v_units    numeric;
  v_meal_exp numeric;
  v_balances jsonb;
begin
  perform private.require_user();
  if v_mess is null then
    raise exception 'not_manager';
  end if;
  select * into s from public.mess_settings where mess_id = v_mess;
  select * into v_closing from public.monthly_closings where mess_id = v_mess and period_month = v_month;

  select coalesce(sum(u.units), 0) into v_units from private.meal_units(v_mess, v_month) u;
  select coalesce(sum(e.amount), 0) into v_meal_exp
    from public.expenses e
   where e.mess_id = v_mess and e.category in ('bazar', 'cooking_gas')
     and e.expense_date >= v_month and e.expense_date < v_next;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.balance asc), '[]'::jsonb) into v_balances
    from (select mm.user_id, p.full_name, p.avatar_url, mm.role, mm.status,
                 r.room_label,
                 coalesce((select sum(l.amount) from public.ledger_entries l
                            where l.mess_id = v_mess and l.user_id = mm.user_id), 0) as balance,
                 coalesce((select u.units from private.meal_units(v_mess, v_month) u where u.user_id = mm.user_id), 0) as month_units
            from public.mess_members mm
            join public.profiles p on p.id = mm.user_id
            left join public.mess_rooms r on r.id = mm.room_id
           where mm.mess_id = v_mess and mm.status in ('active', 'inactive')) b;

  return jsonb_build_object(
    'month', v_month,
    'month_closed', v_closing.id is not null,
    'meal_rate_mode', s.meal_rate_mode,
    'totals', jsonb_build_object(
       'meal_units', v_units,
       'meal_expense', v_meal_exp,
       'meal_rate', case when v_closing.id is not null then v_closing.meal_rate
                         when v_units > 0 then round(v_meal_exp / v_units, 2) else 0 end,
       'shared_expense', (select coalesce(sum(e.amount), 0) from public.expenses e
                           where e.mess_id = v_mess and e.category not in ('bazar', 'cooking_gas')
                             and e.expense_date >= v_month and e.expense_date < v_next),
       'bills_posted', (select coalesce(sum(b.total_amount), 0) from public.bills b
                         where b.mess_id = v_mess and b.period_month = v_month and b.status = 'posted')),
    'collection', jsonb_build_object(
       'deposits', (select coalesce(sum(l.amount), 0) from public.ledger_entries l
                     where l.mess_id = v_mess and l.period_month = v_month and l.entry_type = 'deposit'),
       'pending_amount', (select coalesce(sum(d.amount), 0) from public.deposit_requests d
                           where d.mess_id = v_mess and d.status = 'pending'),
       'total_due', (select coalesce(-sum((x ->> 'balance')::numeric) filter (where (x ->> 'balance')::numeric < 0), 0)
                       from jsonb_array_elements(v_balances) x),
       'total_advance', (select coalesce(sum((x ->> 'balance')::numeric) filter (where (x ->> 'balance')::numeric > 0), 0)
                           from jsonb_array_elements(v_balances) x)),
    'counts', jsonb_build_object(
       'active_members', (select count(*) from public.mess_members where mess_id = v_mess and status = 'active'),
       'inactive_members', (select count(*) from public.mess_members where mess_id = v_mess and status = 'inactive'),
       'pending_requests', (select count(*) from public.mess_members where mess_id = v_mess and status = 'pending'),
       'pending_deposits', (select count(*) from public.deposit_requests where mess_id = v_mess and status = 'pending'),
       'open_complaints', (select count(*) from public.complaints where mess_id = v_mess and status in ('open', 'in_progress')),
       'draft_bills', (select count(*) from public.bills where mess_id = v_mess and status = 'draft')),
    'daily_meals', (
       select coalesce(jsonb_agg(jsonb_build_object(
                'date', d::date,
                'breakfast', coalesce(x.b, 0), 'lunch', coalesce(x.l, 0), 'dinner', coalesce(x.dn, 0),
                'total', coalesce(x.b, 0) + coalesce(x.l, 0) + coalesce(x.dn, 0)) order by d), '[]'::jsonb)
         from generate_series(v_month::timestamp, (v_next - 1)::timestamp, interval '1 day') d
         left join (select m.menu_date,
                           sum(1 + o.guest_count) filter (where m.slot = 'breakfast') as b,
                           sum(1 + o.guest_count) filter (where m.slot = 'lunch') as l,
                           sum(1 + o.guest_count) filter (where m.slot = 'dinner') as dn
                      from public.menus m
                      join public.meal_orders o on o.menu_id = m.id and o.status = 'ordered'
                     where m.mess_id = v_mess and m.menu_date >= v_month and m.menu_date < v_next
                     group by m.menu_date) x on x.menu_date = d::date),
    'expense_breakdown', (
       select coalesce(jsonb_agg(jsonb_build_object('category', e.category, 'amount', e.total) order by e.total desc), '[]'::jsonb)
         from (select category, sum(amount) as total from public.expenses
                where mess_id = v_mess and expense_date >= v_month and expense_date < v_next
                group by category) e),
    'balances', v_balances,
    'top_defaulters', (select coalesce(jsonb_agg(t.member order by t.ord), '[]'::jsonb)
                         from (select e.member, e.ord
                                 from jsonb_array_elements(v_balances) with ordinality as e(member, ord)
                                where (e.member ->> 'balance')::numeric < 0
                                order by e.ord limit 5) t),
    'trend', (
       select coalesce(jsonb_agg(jsonb_build_object(
                'month', mo::date,
                'deposits', (select coalesce(sum(l.amount), 0) from public.ledger_entries l
                              where l.mess_id = v_mess and l.period_month = mo::date and l.entry_type = 'deposit'),
                'expenses', (select coalesce(sum(e.amount), 0) from public.expenses e
                              where e.mess_id = v_mess and e.expense_date >= mo::date
                                and e.expense_date < (mo + interval '1 month')::date),
                'bills', (select coalesce(sum(b.total_amount), 0) from public.bills b
                           where b.mess_id = v_mess and b.period_month = mo::date and b.status = 'posted'))
              order by mo), '[]'::jsonb)
         from generate_series((v_month - interval '5 months')::timestamp, v_month::timestamp, interval '1 month') mo)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Super admin
-- -----------------------------------------------------------------------------
create or replace function private.require_super_admin()
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if not private.is_super_admin() then
    raise exception 'not_super_admin';
  end if;
  return v_uid;
end;
$$;

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
    'active_members', (select count(*) from public.mess_members where status = 'active'),
    'listings', jsonb_build_object(
       'pending', (select count(*) from public.listings where status = 'pending'),
       'approved', (select count(*) from public.listings where status = 'approved')),
    'services_pending', (select count(*) from public.service_providers where status = 'pending'),
    'recipes_pending', (select count(*) from public.recipes where status = 'pending'),
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
       select coalesce(jsonb_agg(jsonb_build_object('area', x.name_bn, 'count', x.n) order by x.n desc), '[]'::jsonb)
         from (select coalesce(a.name_bn, 'অন্যান্য') as name_bn, count(*) as n
                 from public.messes m left join public.areas a on a.id = m.area_id
                where m.is_active group by 1 order by 2 desc limit 10) x)
  );
end;
$$;

-- Approve / reject / archive community content; optionally verify a service.
create or replace function public.moderate_content(
  p_kind     text,
  p_id       uuid,
  p_status   text,
  p_reason   text default null,
  p_verified boolean default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_super_admin();
  v_owner uuid;
  v_title text;
begin
  case p_kind
    when 'listing' then
      update public.listings
         set status = p_status::public.moderation_status,
             rejection_reason = case when p_status = 'rejected' then left(p_reason, 300) end,
             moderated_by = v_uid, moderated_at = now()
       where id = p_id returning owner_id, title into v_owner, v_title;
    when 'service' then
      update public.service_providers
         set status = p_status::public.moderation_status,
             is_verified = coalesce(p_verified, is_verified),
             verified_at = case when p_verified then now() when p_verified = false then null else verified_at end
       where id = p_id returning owner_id, name into v_owner, v_title;
    when 'recipe' then
      update public.recipes set status = p_status::public.moderation_status
       where id = p_id returning created_by, title_bn into v_owner, v_title;
    when 'event' then
      update public.community_events set status = p_status::public.moderation_status
       where id = p_id returning organizer_id, title into v_owner, v_title;
    when 'job' then
      update public.job_posts set status = p_status::public.job_status
       where id = p_id returning posted_by, title into v_owner, v_title;
    when 'market' then
      update public.market_items set status = p_status::public.market_status
       where id = p_id returning seller_id, title into v_owner, v_title;
    else
      raise exception 'invalid_kind';
  end case;

  if v_title is null then
    raise exception 'not_found';
  end if;
  if v_owner is not null and v_owner <> v_uid then
    perform private.notify(v_owner, null, 'moderation',
      case when p_status in ('approved') then 'আপনার পোস্ট প্রকাশিত হয়েছে'
           when p_status in ('rejected', 'removed') then 'আপনার পোস্ট প্রকাশ করা হয়নি'
           else 'আপনার পোস্টের অবস্থা বদলেছে' end,
      v_title || coalesce(' · ' || nullif(trim(p_reason), ''), ''), null,
      jsonb_build_object('kind', p_kind, 'id', p_id, 'status', p_status));
  end if;
end;
$$;

create or replace function public.set_platform_role(p_user_id uuid, p_role public.platform_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_super_admin();
begin
  if p_user_id = v_uid then
    raise exception 'cannot_change_own_role';
  end if;
  update public.profiles set platform_role = p_role where id = p_user_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- "Export my data" and "Delete my account"
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  perform private.check_rate_limit('export:' || v_uid, 5, interval '1 hour');
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'legal_acceptances', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.legal_acceptances x where x.user_id = v_uid),
    'memberships', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.mess_members x where x.user_id = v_uid),
    'ledger', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.ledger_entries x where x.user_id = v_uid),
    'deposit_requests', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.deposit_requests x where x.user_id = v_uid),
    'meal_orders', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.meal_orders x where x.user_id = v_uid),
    'statements', (select coalesce(jsonb_agg(to_jsonb(x) order by x.period_month), '[]') from public.member_statements x where x.user_id = v_uid),
    'bill_shares', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.bill_shares x where x.user_id = v_uid),
    'complaints', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.complaints x where x.created_by = v_uid),
    'listings', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.listings x where x.owner_id = v_uid),
    'roommate_profile', (select to_jsonb(x) from public.roommate_profiles x where x.user_id = v_uid),
    'rent_records', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.rent_records x where x.user_id = v_uid),
    'rent_payments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.rent_payments x where x.user_id = v_uid),
    'move_checklists', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.move_checklists x where x.user_id = v_uid),
    'market_items', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.market_items x where x.seller_id = v_uid),
    'service_reviews', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.service_reviews x where x.user_id = v_uid),
    'emergency_contacts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.emergency_contacts x where x.user_id = v_uid),
    'budget_entries', (select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date), '[]') from public.budget_entries x where x.user_id = v_uid),
    'monthly_budgets', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.monthly_budgets x where x.user_id = v_uid),
    'mood_checkins', (select coalesce(jsonb_agg(to_jsonb(x) order by x.checkin_date), '[]') from public.mood_checkins x where x.user_id = v_uid),
    'care_alerts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.care_alerts x where x.user_id = v_uid),
    'safety_checkins', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.safety_checkins x where x.user_id = v_uid),
    'reminders', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.reminders x where x.user_id = v_uid),
    'water_logs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.water_logs x where x.user_id = v_uid),
    'family_call_logs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.family_call_logs x where x.user_id = v_uid),
    'loans', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.loans x where x.user_id = v_uid),
    'loan_payments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.loan_payments x where x.user_id = v_uid),
    'feedback', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.feedback x where x.user_id = v_uid)
  );
end;
$$;

-- Wipes personal data and anonymises the profile. Mess financial records
-- (ledger, statements, orders) stay — anonymised — because the rest of the
-- mess needs them to balance. The Next.js action then deletes the user's
-- storage files and soft-deletes the auth user.
create or replace function public.delete_my_account_data()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_user();
  v_member public.mess_members%rowtype;
begin
  select * into v_member from public.mess_members
   where user_id = v_uid and status in ('pending', 'active', 'inactive');

  if v_member.id is not null and v_member.status <> 'pending' and v_member.role = 'manager'
     and not exists (select 1 from public.mess_members
                     where mess_id = v_member.mess_id and role = 'manager' and status = 'active' and id <> v_member.id)
     and exists (select 1 from public.mess_members
                 where mess_id = v_member.mess_id and status in ('active', 'inactive') and id <> v_member.id) then
    raise exception 'transfer_manager_first';
  end if;

  if v_member.status = 'pending' then
    delete from public.mess_members where id = v_member.id;
  elsif v_member.id is not null then
    update public.mess_members set status = 'left', left_at = now(), room_id = null where id = v_member.id;
    perform private.notify_managers(v_member.mess_id, 'member_left', 'একজন সদস্য অ্যাকাউন্ট মুছে ফেলেছেন',
      'হিসাবের ব্যালেন্স: ' || private.taka(private.balance_of(v_member.mess_id, v_uid)), '/manage/members');
  end if;

  delete from public.mood_checkins where user_id = v_uid;
  delete from public.care_alert_recipients where user_id = v_uid;
  delete from public.care_alerts where user_id = v_uid;
  delete from public.safety_checkins where user_id = v_uid;
  delete from public.reminders where user_id = v_uid;
  delete from public.water_logs where user_id = v_uid;
  delete from public.family_call_logs where user_id = v_uid;
  delete from public.loans where user_id = v_uid;
  delete from public.budget_entries where user_id = v_uid;
  delete from public.monthly_budgets where user_id = v_uid;
  delete from public.emergency_contacts where user_id = v_uid;
  update public.emergency_contacts set contact_user_id = null where contact_user_id = v_uid;
  delete from public.roommate_profiles where user_id = v_uid;
  delete from public.rent_records where user_id = v_uid;
  delete from public.move_checklists where user_id = v_uid;
  delete from public.saved_listings where user_id = v_uid;
  delete from public.listings where owner_id = v_uid;
  delete from public.market_items where seller_id = v_uid;
  delete from public.event_rsvps where user_id = v_uid;
  delete from public.community_events where organizer_id = v_uid;
  delete from public.job_posts where posted_by = v_uid;
  delete from public.service_reviews where user_id = v_uid;
  delete from public.notifications where user_id = v_uid;
  delete from public.legal_acceptances where user_id = v_uid;
  delete from public.poll_votes where user_id = v_uid;
  update public.feedback set user_id = null, contact_email = null where user_id = v_uid;

  perform private.set_internal(true);
  update public.service_providers set owner_id = null, status = 'archived' where owner_id = v_uid;
  update public.recipes set created_by = null where created_by = v_uid;
  update public.profiles
     set full_name = 'মুছে ফেলা ব্যবহারকারী', email = null, phone = null, avatar_url = null,
         gender = null, occupation = null, institution = null, home_district = null, blood_group = null,
         guardian_name = null, guardian_phone = null, bio = null, is_deleted = true
   where id = v_uid;
  perform private.set_internal(false);

  return jsonb_build_object('ok', true, 'kept', 'mess_financial_records_anonymised');
end;
$$;

-- Hard-delete whole messes and users, including their immutable ledger rows.
-- SQL-editor only (demo removal, test cleanup); never callable through the API.
create or replace function private.purge_data(p_mess_ids uuid[], p_user_ids uuid[])
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_system_call() then
    raise exception 'system_only';
  end if;
  perform set_config('messmate.purge', 'on', true);

  delete from public.member_statements where mess_id = any (p_mess_ids) or user_id = any (p_user_ids);
  delete from public.bill_shares where mess_id = any (p_mess_ids) or user_id = any (p_user_ids);
  delete from public.deposit_requests where mess_id = any (p_mess_ids) or user_id = any (p_user_ids);
  delete from public.expenses where mess_id = any (p_mess_ids);
  delete from public.ledger_entries
   where (mess_id = any (p_mess_ids) or user_id = any (p_user_ids)) and reverses_id is not null;
  delete from public.ledger_entries where mess_id = any (p_mess_ids) or user_id = any (p_user_ids);
  delete from public.monthly_closings where mess_id = any (p_mess_ids);
  delete from public.bills where mess_id = any (p_mess_ids);
  delete from public.meal_orders where mess_id = any (p_mess_ids) or user_id = any (p_user_ids);
  delete from public.menus where mess_id = any (p_mess_ids);
  delete from public.messes where id = any (p_mess_ids);
  delete from public.mess_members where user_id = any (p_user_ids);
  delete from public.complaint_updates where author_id = any (p_user_ids);
  delete from public.complaints where created_by = any (p_user_ids);
  delete from public.chores where assigned_to = any (p_user_ids);
  delete from public.polls where created_by = any (p_user_ids);
  delete from auth.users where id = any (p_user_ids);
  delete from public.audit_logs where mess_id = any (p_mess_ids) or actor_id = any (p_user_ids);
  delete from private.rate_limits
   where key like any (array(select '%' || u::text from unnest(p_user_ids) u));

  perform set_config('messmate.purge', 'off', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Scheduled jobs (pg_cron, see 0013)
-- -----------------------------------------------------------------------------

-- Every 5 minutes: overdue "reached home" check-ins and due reminders.
create or replace function private.process_due_jobs()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_local     timestamp := now() at time zone 'Asia/Dhaka';
  v_today     date := (now() at time zone 'Asia/Dhaka')::date;
  v_overdue   integer := 0;
  v_reminders integer := 0;
  r           record;
begin
  for r in select * from public.safety_checkins
            where status = 'pending' and expected_by < now()
            for update skip locked loop
    perform private.set_internal(true);
    update public.safety_checkins set status = 'overdue', overdue_notified_at = now() where id = r.id;
    perform private.set_internal(false);

    insert into public.notifications (user_id, type, title, body, link, data)
    select ec.contact_user_id, 'checkin_overdue',
           'খোঁজ নিন: ' || private.display_name(r.user_id) || ' এখনো পৌঁছানোর খবর দেননি',
           r.label || ' · নির্ধারিত সময় পেরিয়ে গেছে। একবার ফোন করে দেখুন।', '/care',
           jsonb_build_object('checkin_id', r.id, 'user_id', r.user_id)
      from public.emergency_contacts ec
     where ec.user_id = r.user_id and ec.contact_user_id is not null and ec.notify_on_checkin;

    perform private.notify(r.user_id, null, 'checkin_self', 'আপনি কি ঠিক আছেন?',
      'বাসায় পৌঁছালে "পৌঁছেছি" চাপুন, যাতে কেউ দুশ্চিন্তা না করে।', '/care',
      jsonb_build_object('checkin_id', r.id));
    v_overdue := v_overdue + 1;
  end loop;

  with due as (
    update public.reminders rm
       set last_sent_on = v_today
     where rm.is_active
       and extract(dow from v_local)::smallint = any (rm.days_of_week)
       and (v_local::time - rm.remind_at) between interval '0' and interval '60 minutes'
       and (rm.last_sent_on is null or rm.last_sent_on < v_today)
    returning rm.id, rm.user_id, rm.title, rm.note, rm.reminder_type
  )
  insert into public.notifications (user_id, type, title, body, link, data)
  select d.user_id, 'reminder', d.title,
         coalesce(d.note, case d.reminder_type
                            when 'medicine' then 'ওষুধ খাওয়ার সময় হয়েছে।'
                            when 'water' then 'এক গ্লাস পানি খেয়ে নিন।'
                            when 'sleep' then 'ঘুমানোর সময় হয়ে গেছে। ফোনটা রেখে দিন।'
                            when 'call_home' then 'বাড়িতে একবার ফোন করুন, সবাই খুশি হবে।'
                            when 'rent' then 'ভাড়া দেওয়ার সময় হয়েছে।'
                            when 'bill' then 'বিল দেওয়ার কথা মনে আছে?'
                            else 'রিমাইন্ডার' end),
         '/care', jsonb_build_object('reminder_id', d.id, 'type', d.reminder_type)
    from due d;
  get diagnostics v_reminders = row_count;

  return jsonb_build_object('overdue_checkins', v_overdue, 'reminders_sent', v_reminders);
end;
$$;

-- Daily (00:30 Dhaka): month auto-close, poll / job expiry, rent reminders,
-- housekeeping to stay inside the free tier.
create or replace function private.run_daily_jobs()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today   date := private.dhaka_today();
  v_closed  integer;
  v_polls   integer;
  v_jobs    integer;
  v_rent    integer;
begin
  v_closed := private.auto_close_due_months();

  update public.polls set is_closed = true where not is_closed and closes_at < now();
  get diagnostics v_polls = row_count;

  update public.job_posts set status = 'closed' where status = 'open' and expires_at < v_today;
  get diagnostics v_jobs = row_count;

  insert into public.notifications (user_id, type, title, body, link, data)
  select rr.user_id, 'rent_due', 'ভাড়ার তারিখ আসছে: ' || rr.title,
         private.taka(rr.monthly_rent) || ' · ' || rr.rent_due_day || ' তারিখের মধ্যে দিতে হবে।', '/housing/rent',
         jsonb_build_object('rent_record_id', rr.id, 'period_month', private.month_start(v_today))
    from public.rent_records rr
   where rr.is_active
     and extract(day from v_today) = greatest(rr.rent_due_day - 2, 1)
     and not exists (select 1 from public.rent_payments rp
                      where rp.rent_record_id = rr.id and rp.period_month = private.month_start(v_today));
  get diagnostics v_rent = row_count;

  delete from private.rate_limits where window_start < now() - interval '2 days';
  delete from public.notifications where read_at is not null and created_at < now() - interval '90 days';

  return jsonb_build_object('months_closed', v_closed, 'polls_closed', v_polls, 'jobs_expired', v_jobs, 'rent_reminders', v_rent);
end;
$$;
