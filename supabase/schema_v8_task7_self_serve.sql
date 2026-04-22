-- ─────────────────────────────────────────
-- V8 — Self-serve client onboarding (Task 7)
-- Run in Supabase SQL Editor.
--
-- BEFORE RUNNING: capture the current handle_new_user trigger body for
-- reference. In a psql session:
--   \sf handle_new_user
-- or via SQL:
--   select pg_get_functiondef((select oid from pg_proc where proname = 'handle_new_user'));
-- ─────────────────────────────────────────

-- 1. Slug generator — lowercased, hyphenated, unique by appending -2, -3…
create or replace function generate_unique_client_slug(base text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate text;
  n         int := 1;
begin
  -- Lowercase, replace non-alnum with hyphens, trim edges, collapse runs
  base_slug := lower(regexp_replace(base, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  if base_slug = '' then
    base_slug := 'client';
  end if;

  candidate := base_slug;
  while exists (select 1 from clients where slug = candidate) loop
    n := n + 1;
    candidate := base_slug || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

-- 2. handle_new_user — extended to support BOTH admin-invited flows
--    (profile row already created with client_id set, leave alone) AND
--    self-serve signup (no client_id in metadata → create a new clients
--    row and link the profile to it).
--
-- The function is idempotent: it handles the case where a profile row
-- already exists (invite flow creates one), and the case where it
-- doesn't (self-serve new user).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  business_name text;
  new_client_id uuid;
  new_slug      text;
  existing_profile record;
begin
  -- If a profile row already exists for this auth user (e.g. created by an
  -- admin invite), we leave it alone — just make sure onboarding is still
  -- false so the client gets the new-user UX, but DO NOT overwrite
  -- client_id / role / name that the inviter set.
  select * into existing_profile from profiles where id = new.id;
  if found then
    return new;
  end if;

  -- Self-serve path. Pull the business name from the auth metadata the
  -- signup form stashes there:
  --   supabase.auth.signUp({ email, password, options: { data: { business_name } } })
  business_name := coalesce(
    new.raw_user_meta_data ->> 'business_name',
    new.raw_user_meta_data ->> 'businessName',
    split_part(new.email, '@', 1)
  );

  new_slug := generate_unique_client_slug(business_name);

  insert into clients (name, slug, color)
  values (business_name, new_slug, '#4950F8')
  returning id into new_client_id;

  insert into profiles (id, client_id, role, onboarding_complete)
  values (new.id, new_client_id, 'client', false);

  return new;
end;
$$;

-- Ensure the trigger is attached (usually already exists)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 3. Storage bucket for client logos — create if missing, scoped RLS
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do nothing;

-- Only members of a client (or staff/admin) can upload/delete into their
-- own client_id folder. The path convention is `<client_id>/<filename>`.
drop policy if exists "client_logos_select" on storage.objects;
create policy "client_logos_select"
  on storage.objects for select
  to public
  using (bucket_id = 'client-logos');

drop policy if exists "client_logos_insert_own" on storage.objects;
create policy "client_logos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-logos'
    and (
      (storage.foldername(name))[1] = (
        select client_id::text from profiles where id = auth.uid()
      )
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and (p.is_staff = true or p.is_admin = true)
      )
    )
  );

drop policy if exists "client_logos_update_own" on storage.objects;
create policy "client_logos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-logos'
    and (
      (storage.foldername(name))[1] = (
        select client_id::text from profiles where id = auth.uid()
      )
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and (p.is_staff = true or p.is_admin = true)
      )
    )
  );

drop policy if exists "client_logos_delete_own" on storage.objects;
create policy "client_logos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-logos'
    and (
      (storage.foldername(name))[1] = (
        select client_id::text from profiles where id = auth.uid()
      )
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and (p.is_staff = true or p.is_admin = true)
      )
    )
  );

-- Verification:
-- select slug from clients where slug ~ '^.*-\d+$';  -- confirms dedupe
-- select pg_get_functiondef((select oid from pg_proc where proname='handle_new_user'));
