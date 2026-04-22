-- ─────────────────────────────────────────
-- V5 — Brief attribution: created_by + assigned_users junction (Task 4)
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────

-- 1. Add created_by column to briefs if missing
alter table briefs
  add column if not exists created_by uuid references profiles(id);

create index if not exists idx_briefs_created_by on briefs(created_by);

-- Leave existing rows with NULL created_by. The UI falls back to "unknown" for
-- legacy briefs; future inserts set created_by from the caller.

-- 2. Junction table for tagged users on briefs
create table if not exists brief_assigned_users (
  brief_id   uuid not null references briefs(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brief_id, user_id)
);

create index if not exists idx_brief_assigned_users_brief on brief_assigned_users(brief_id);
create index if not exists idx_brief_assigned_users_user  on brief_assigned_users(user_id);

-- 3. RLS — a user can read/write assignments for briefs they can already see.
--    Visibility mirrors briefs-level RLS: client users scoped to their client,
--    staff scoped via staff_client_access or global is_staff.
alter table brief_assigned_users enable row level security;

drop policy if exists "brief_assigned_users_select" on brief_assigned_users;
create policy "brief_assigned_users_select"
  on brief_assigned_users for select
  to authenticated
  using (
    exists (
      select 1
      from briefs b
      where b.id = brief_assigned_users.brief_id
        and (
          -- Client user in the same tenant
          b.client_id in (select client_id from profiles where id = auth.uid())
          -- Staff with explicit access to this client
          or exists (
            select 1 from staff_client_access sca
            where sca.staff_id = auth.uid() and sca.client_id = b.client_id
          )
          -- Global staff/admin
          or exists (
            select 1 from profiles p
            where p.id = auth.uid() and (p.is_staff = true or p.is_admin = true)
          )
        )
    )
  );

drop policy if exists "brief_assigned_users_insert" on brief_assigned_users;
create policy "brief_assigned_users_insert"
  on brief_assigned_users for insert
  to authenticated
  with check (
    exists (
      select 1
      from briefs b
      where b.id = brief_assigned_users.brief_id
        and (
          b.client_id in (select client_id from profiles where id = auth.uid())
          or exists (
            select 1 from staff_client_access sca
            where sca.staff_id = auth.uid() and sca.client_id = b.client_id
          )
          or exists (
            select 1 from profiles p
            where p.id = auth.uid() and (p.is_staff = true or p.is_admin = true)
          )
        )
    )
  );

drop policy if exists "brief_assigned_users_delete" on brief_assigned_users;
create policy "brief_assigned_users_delete"
  on brief_assigned_users for delete
  to authenticated
  using (
    exists (
      select 1
      from briefs b
      where b.id = brief_assigned_users.brief_id
        and (
          b.client_id in (select client_id from profiles where id = auth.uid())
          or exists (
            select 1 from staff_client_access sca
            where sca.staff_id = auth.uid() and sca.client_id = b.client_id
          )
          or exists (
            select 1 from profiles p
            where p.id = auth.uid() and (p.is_staff = true or p.is_admin = true)
          )
        )
    )
  );
