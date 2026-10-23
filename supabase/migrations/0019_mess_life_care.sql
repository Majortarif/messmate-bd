-- =============================================================================
-- MessMate BD · 0019 · Mess life + Care read models
-- One call per screen instead of one per poll / alert: the polls page, the
-- Care hub and a single Care alert. Read-only; every function checks access.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Polls of the caller's mess with options and live counts.
-- Voter names only for non-anonymous polls; the caller's own choice always.
-- -----------------------------------------------------------------------------
create or replace function public.get_mess_polls(p_limit integer default 30)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_mess uuid := private.current_mess_id();
begin
  if v_mess is null then
    raise exception 'not_member';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id,
             'question', p.question,
             'description', p.description,
             'allow_multiple', p.allow_multiple,
             'is_anonymous', p.is_anonymous,
             'closes_at', p.closes_at,
             'is_closed', p.is_closed or (p.closes_at is not null and p.closes_at <= now()),
             'created_at', p.created_at,
             'created_by', p.created_by,
             'creator_name', private.display_name(p.created_by),
             'voters', (select count(distinct pv.user_id) from public.poll_votes pv where pv.poll_id = p.id),
             'options', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'id', po.id,
                        'label', po.label,
                        'votes', (select count(*) from public.poll_votes pv where pv.option_id = po.id),
                        'mine', exists (select 1 from public.poll_votes pv where pv.option_id = po.id and pv.user_id = v_uid),
                        'names', case when p.is_anonymous then '[]'::jsonb
                                      else coalesce((select jsonb_agg(private.display_name(pv.user_id) order by pv.created_at)
                                                       from public.poll_votes pv where pv.option_id = po.id), '[]'::jsonb) end)
                      order by po.sort_order, po.label), '[]'::jsonb)
                 from public.poll_options po where po.poll_id = p.id))
           order by (p.is_closed or (p.closes_at is not null and p.closes_at <= now())), p.created_at desc), '[]'::jsonb)
      from (select * from public.polls
             where mess_id = v_mess
             order by created_at desc
             limit least(greatest(coalesce(p_limit, 30), 1), 100)) p
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Care hub: everything the caller needs on one screen. Owner-only data, plus
-- alerts other people sent to the caller.
-- -----------------------------------------------------------------------------
create or replace function public.get_care_overview()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_today date := private.dhaka_today();
begin
  return jsonb_build_object(
    'today', v_today,
    'mood_today', (select jsonb_build_object('mood', m.mood, 'note', m.note)
                     from public.mood_checkins m where m.user_id = v_uid and m.checkin_date = v_today),
    'mood_week', (select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'mood', m.mood) order by d), '[]'::jsonb)
                    from generate_series((v_today - 6)::timestamp, v_today::timestamp, interval '1 day') d
                    left join public.mood_checkins m on m.user_id = v_uid and m.checkin_date = d::date),
    'water_today', (select jsonb_build_object('glasses', w.glasses, 'goal', w.goal)
                      from public.water_logs w where w.user_id = v_uid and w.log_date = v_today),
    'water_goal', coalesce((select w.goal from public.water_logs w where w.user_id = v_uid order by w.log_date desc limit 1), 8),
    'active_checkin', (select jsonb_build_object('id', c.id, 'label', c.label, 'expected_by', c.expected_by, 'status', c.status)
                         from public.safety_checkins c
                        where c.user_id = v_uid and c.status in ('pending', 'overdue')
                        order by c.created_at desc limit 1),
    'last_family_call', (select max(f.called_at) from public.family_call_logs f where f.user_id = v_uid),
    'contacts', (select count(*) from public.emergency_contacts ec where ec.user_id = v_uid),
    'reminders_active', (select count(*) from public.reminders r where r.user_id = v_uid and r.is_active),
    'my_alerts', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', a.id, 'type', a.alert_type, 'status', a.status, 'created_at', a.created_at,
                    'responses', (select count(*) from public.care_alert_recipients r where r.alert_id = a.id and r.responded_at is not null),
                    'recipients', (select count(*) from public.care_alert_recipients r where r.alert_id = a.id))
                  order by a.created_at desc), '[]'::jsonb)
                    from public.care_alerts a
                   where a.user_id = v_uid and a.status <> 'resolved'),
    'alerts_for_me', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', a.id, 'type', a.alert_type, 'status', a.status, 'created_at', a.created_at,
                        'name', private.display_name(a.user_id), 'message', a.message, 'needs', a.needs,
                        'my_response', r.response)
                      order by a.created_at desc), '[]'::jsonb)
                        from public.care_alert_recipients r
                        join public.care_alerts a on a.id = r.alert_id
                       where r.user_id = v_uid and a.status <> 'resolved'
                         and a.created_at > now() - interval '3 days')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- One Care alert, for its owner or a person it was sent to.
-- -----------------------------------------------------------------------------
create or replace function public.get_care_alert(p_alert_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  a       public.care_alerts%rowtype;
  v_owner boolean;
begin
  select * into a from public.care_alerts where id = p_alert_id;
  if not found then
    raise exception 'not_found';
  end if;
  v_owner := a.user_id = v_uid;
  if not v_owner and not exists (select 1 from public.care_alert_recipients r where r.alert_id = a.id and r.user_id = v_uid) then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'id', a.id,
    'is_owner', v_owner,
    'type', a.alert_type,
    'status', a.status,
    'message', a.message,
    'needs', a.needs,
    'lat', a.lat,
    'lng', a.lng,
    'location_text', a.location_text,
    'created_at', a.created_at,
    'resolved_at', a.resolved_at,
    'name', private.display_name(a.user_id),
    'phone', (select p.phone from public.profiles p where p.id = a.user_id),
    'my_response', (select r.response from public.care_alert_recipients r where r.alert_id = a.id and r.user_id = v_uid),
    'recipients', (select coalesce(jsonb_agg(jsonb_build_object(
                     'name', private.display_name(r.user_id), 'response', r.response, 'responded_at', r.responded_at)
                   order by r.responded_at nulls last), '[]'::jsonb)
                     from public.care_alert_recipients r where r.alert_id = a.id)
  );
end;
$$;

revoke execute on function public.get_mess_polls(integer) from public, anon;
revoke execute on function public.get_care_overview() from public, anon;
revoke execute on function public.get_care_alert(uuid) from public, anon;
grant execute on function public.get_mess_polls(integer) to authenticated, service_role;
grant execute on function public.get_care_overview() to authenticated, service_role;
grant execute on function public.get_care_alert(uuid) to authenticated, service_role;
