-- =============================================================================
-- MessMate BD · 0018 · Community display names, roommate matches in English
-- Housing, marketplace and service reviews are shared across messes, but
-- profiles stay private to messmates. These helpers show strangers a short
-- name ("Rafi A.") and give roommate matches English area names too.
-- =============================================================================

-- "Rafi Ahmed" -> "Rafi A." ; one-word names stay as they are.
create or replace function private.short_name(p_name text)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when coalesce(trim(p_name), '') = '' then null
    when cardinality(regexp_split_to_array(trim(p_name), '\s+')) = 1 then trim(p_name)
    else (regexp_split_to_array(trim(p_name), '\s+'))[1] || ' '
         || left((regexp_split_to_array(trim(p_name), '\s+'))[2], 1) || '.'
  end
$$;

-- Names for the people behind community posts and reviews. Messmates (anyone
-- you could already see) get the full name; everyone else the short name.
-- Deleted accounts come back without a name. At most 200 ids per call.
create or replace function public.get_display_names(p_ids uuid[])
returns table (id uuid, name text, avatar_url text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  return query
  select p.id,
         case when p.is_deleted then null
              when private.can_view_profile(p.id) then nullif(trim(p.full_name), '')
              else private.short_name(p.full_name) end,
         case when p.is_deleted then null else p.avatar_url end
    from public.profiles p
   where p.id = any ((p_ids)[1:200]);
end;
$$;

-- Same scoring as 0006; adds area_names_en so the English UI can show areas.
drop function if exists public.roommate_matches(integer);
create function public.roommate_matches(p_limit integer default 20)
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
  area_names_en  text[],
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
         (select array_agg(a.name_en order by a.sort_order) from public.areas a where a.id = any (sc.c_areas)),
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
   order by 18 desc, sc.updated_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke execute on function public.get_display_names(uuid[]) from public, anon;
revoke execute on function public.roommate_matches(integer) from public, anon;
grant execute on function public.get_display_names(uuid[]) to authenticated, service_role;
grant execute on function public.roommate_matches(integer) to authenticated, service_role;
