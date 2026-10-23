-- =============================================================================
-- MessMate BD · 0015 · Meal-rate mode can't change mid-month
-- Switching auto ↔ fixed while an open month already has orders would charge
-- those meals twice (or never). The switch is allowed only when no open
-- (unclosed) month of the mess has ordered meals — e.g. a brand-new mess, or
-- right after closing a month before anyone orders.
-- =============================================================================

create or replace function private.guard_meal_mode_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.meal_rate_mode is distinct from old.meal_rate_mode
     and exists (
       select 1
         from public.meal_orders o
         join public.menus m on m.id = o.menu_id
        where m.mess_id = new.mess_id
          and o.status = 'ordered'
          and not private.is_month_closed(m.mess_id, m.menu_date)) then
    raise exception 'mode_change_blocked';
  end if;
  return new;
end;
$$;

drop trigger if exists mess_settings_mode_guard on public.mess_settings;
create trigger mess_settings_mode_guard before update of meal_rate_mode on public.mess_settings
  for each row execute function private.guard_meal_mode_change();
