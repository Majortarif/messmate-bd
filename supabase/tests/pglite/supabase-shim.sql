-- =============================================================================
-- Minimal Supabase stand-in for local testing in PGlite.
-- NOT a migration — never run this on a real Supabase project.
-- Recreates just enough of auth / storage / cron / roles / default grants for
-- the MessMate migrations, seed and test suites to behave as they do on Supabase.
-- =============================================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
create role supabase_auth_admin login noinherit;
grant anon, authenticated, service_role to authenticator;

create schema extensions;
create schema auth;
create schema storage;
create schema cron;

grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

-- Supabase default privileges for objects created by postgres in public.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------- auth -------
create table auth.users (
  instance_id                 uuid,
  id                          uuid primary key,
  aud                         text,
  role                        text,
  email                       text unique,
  encrypted_password          text,
  email_confirmed_at          timestamptz,
  invited_at                  timestamptz,
  confirmation_token          text,
  confirmation_sent_at        timestamptz,
  recovery_token              text,
  recovery_sent_at            timestamptz,
  email_change_token_new      text,
  email_change                text,
  email_change_token_current  text default '',
  phone_change                text default '',
  phone_change_token          text default '',
  reauthentication_token      text default '',
  last_sign_in_at             timestamptz,
  raw_app_meta_data           jsonb,
  raw_user_meta_data          jsonb,
  is_super_admin              boolean,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),
  deleted_at                  timestamptz
);

create table auth.identities (
  id               uuid primary key default gen_random_uuid(),
  provider_id      text not null,
  user_id          uuid not null references auth.users (id) on delete cascade,
  identity_data    jsonb not null,
  provider         text not null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (provider_id, provider)
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), '')::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- ------------------------------------------------------------- storage -------
create table storage.buckets (
  id                  text primary key,
  name                text not null unique,
  owner               uuid,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets (id),
  name        text,
  owner       uuid,
  metadata    jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end
$$;

-- ---------------------------------------------------------------- cron -------
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);

create function cron.schedule(job_name text, schedule text, command text) returns bigint
language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;

create function cron.unschedule(job_name text) returns boolean
language sql as $$
  with d as (delete from cron.job where jobname = job_name returning 1) select exists (select 1 from d)
$$;
