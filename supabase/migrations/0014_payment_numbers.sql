-- =============================================================================
-- MessMate BD · 0014 · Where members should send money
-- The manager's bKash / Nagad / Rocket numbers and a short instruction, shown on
-- the "Add money" screen. (Apply on its own if setup.sql was already run.)
-- =============================================================================

alter table public.mess_settings
  add column if not exists bkash_number  text check (bkash_number ~ '^01[3-9][0-9]{8}$'),
  add column if not exists nagad_number  text check (nagad_number ~ '^01[3-9][0-9]{8}$'),
  -- Rocket account numbers are the mobile number plus one check digit
  add column if not exists rocket_number text check (rocket_number ~ '^01[3-9][0-9]{8,9}$'),
  add column if not exists payment_note  text check (char_length(payment_note) <= 300);
