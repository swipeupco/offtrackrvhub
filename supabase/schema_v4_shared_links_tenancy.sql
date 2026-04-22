-- ─────────────────────────────────────────
-- V4 — Multi-tenancy for shared_links (Task 3)
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────

-- 1. Add client_id column to shared_links if missing
alter table shared_links
  add column if not exists client_id uuid references clients(id);

-- 2. Backfill existing rows from the creator's profile
--    (shared_links.created_by → profiles.id → profiles.client_id)
update shared_links sl
set client_id = p.client_id
from profiles p
where sl.created_by = p.id
  and sl.client_id is null
  and p.client_id is not null;

-- 3. Fallback: any remaining NULLs go to OTRV while they're the only
--    active van client. This matches the spec's guidance; flag a
--    review if multiple van clients are onboarded later.
update shared_links
set client_id = '11bb3a1f-c462-4e47-ba14-dc76dab46da1'
where client_id is null;

-- 4. Enforce NOT NULL going forward so a missing client_id is caught
--    at insert time.
alter table shared_links
  alter column client_id set not null;

-- 5. Index on the tenancy column for filtered lookups.
create index if not exists idx_shared_links_client_id on shared_links(client_id);

-- 6. RLS — scope authenticated reads/inserts to the user's own client.
--    The existing public-token read path (used by /share/calendar/[token])
--    continues to work because the /api/shared-link handler looks the
--    token up server-side with the anon role; do NOT drop any existing
--    anon-read policy without confirming the handler still functions.
alter table shared_links enable row level security;

drop policy if exists "shared_links_select_own_client" on shared_links;
create policy "shared_links_select_own_client"
  on shared_links for select
  to authenticated
  using (
    client_id in (select client_id from profiles where id = auth.uid())
  );

drop policy if exists "shared_links_insert_own_client" on shared_links;
create policy "shared_links_insert_own_client"
  on shared_links for insert
  to authenticated
  with check (
    client_id in (select client_id from profiles where id = auth.uid())
  );

drop policy if exists "shared_links_update_own_client" on shared_links;
create policy "shared_links_update_own_client"
  on shared_links for update
  to authenticated
  using (
    client_id in (select client_id from profiles where id = auth.uid())
  )
  with check (
    client_id in (select client_id from profiles where id = auth.uid())
  );

drop policy if exists "shared_links_delete_own_client" on shared_links;
create policy "shared_links_delete_own_client"
  on shared_links for delete
  to authenticated
  using (
    client_id in (select client_id from profiles where id = auth.uid())
  );

-- 7. Verify result:
-- select count(*) as orphaned from shared_links where client_id is null;
-- expected: 0
