-- ─────────────────────────────────────────
-- V6 — Notifications + mentions (Task 5)
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────

-- ----- 1. notifications: add user scoping + event type -----
alter table notifications
  add column if not exists user_id    uuid references profiles(id) on delete cascade;

alter table notifications
  add column if not exists event_type text;

create index if not exists idx_notifications_user_unread
  on notifications(user_id, read_at)
  where read_at is null;

create index if not exists idx_notifications_user_recent
  on notifications(user_id, created_at desc);

-- Backfill note: existing notifications may have NULL user_id. The bell UI
-- will filter them out (they'll be orphaned). If you want to recover them,
-- inspect the `link` column for /trello?briefId=X and join to briefs to
-- guess the recipient. For a pre-launch audit, leaving NULL is fine.

-- ----- 2. notification_preferences -----
create table if not exists notification_preferences (
  user_id          uuid not null references profiles(id) on delete cascade,
  event_type       text not null,
  email_enabled    boolean not null default true,
  in_app_enabled   boolean not null default true,
  updated_at       timestamptz not null default now(),
  primary key (user_id, event_type)
);

-- Canonical event_type values used across the app:
--   'mentioned'         — someone @mentioned me in a comment
--   'new_comment'       — someone commented on a brief I created or am tagged on
--   'ready_for_review'  — a brief I'm involved with moved to client_review
--   'status_change'     — (room for future) any status change on a tagged brief

alter table notification_preferences enable row level security;

drop policy if exists "notif_prefs_owner_all" on notification_preferences;
create policy "notif_prefs_owner_all"
  on notification_preferences for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Seed sensible defaults for existing users (all events on)
insert into notification_preferences (user_id, event_type, email_enabled, in_app_enabled)
select p.id, e.event_type, true, true
from profiles p
cross join (values ('mentioned'), ('new_comment'), ('ready_for_review'), ('status_change')) as e(event_type)
on conflict do nothing;

-- ----- 3. comment_mentions junction -----
create table if not exists comment_mentions (
  comment_id uuid not null references brief_comments(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists idx_comment_mentions_user on comment_mentions(user_id);

alter table comment_mentions enable row level security;

-- Read: anyone who can read the parent comment can read its mentions
drop policy if exists "comment_mentions_select" on comment_mentions;
create policy "comment_mentions_select"
  on comment_mentions for select
  to authenticated
  using (
    exists (
      select 1
      from brief_comments bc
      join briefs b on b.id = bc.brief_id
      where bc.id = comment_mentions.comment_id
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

-- Insert: only the comment author (the trigger runs as security-definer below
-- to bypass RLS for cross-user fan-out; this direct-insert path is for UI)
drop policy if exists "comment_mentions_insert_author" on comment_mentions;
create policy "comment_mentions_insert_author"
  on comment_mentions for insert
  to authenticated
  with check (
    exists (
      select 1 from brief_comments bc
      where bc.id = comment_mentions.comment_id
        and bc.user_id = auth.uid()
    )
  );

-- ----- 4. Notifications RLS (scope to owner) -----
alter table notifications enable row level security;

drop policy if exists "notifications_owner_select" on notifications;
create policy "notifications_owner_select"
  on notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_owner_update" on notifications;
create policy "notifications_owner_update"
  on notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts come from triggers running as security definer below; no
-- authenticated-role insert policy needed unless the app creates its own.

-- ----- 5. Trigger: on brief_comments INSERT fan out notifications -----
create or replace function notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mentioned_uid uuid;
  subscriber_uid uuid;
  brief_name text;
  brief_client_id uuid;
  actor_name text;
begin
  select name into brief_name from briefs where id = new.brief_id;
  select client_id into brief_client_id from briefs where id = new.brief_id;
  select coalesce(name, 'Someone') into actor_name from profiles where id = new.user_id;

  -- Mention notifications: comment_mentions rows inserted by the app for
  -- this comment. (The UI inserts them just after the comment.)
  for mentioned_uid in
    select user_id from comment_mentions
    where comment_id = new.id
      and user_id <> coalesce(new.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    insert into notifications (user_id, event_type, type, message, link, brief_id, brief_name)
    values (
      mentioned_uid,
      'mentioned',
      'comment',
      actor_name || ' mentioned you on "' || coalesce(brief_name, 'a brief') || '"',
      '/trello?briefId=' || new.brief_id::text,
      new.brief_id,
      brief_name
    );
  end loop;

  -- New-comment notifications for brief creator + tagged users, excluding
  -- the comment author and anyone already notified as a mention above.
  for subscriber_uid in
    select distinct uid from (
      select created_by as uid from briefs where id = new.brief_id and created_by is not null
      union
      select user_id  as uid from brief_assigned_users where brief_id = new.brief_id
    ) s
    where uid is not null
      and uid <> coalesce(new.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and uid not in (
        select user_id from comment_mentions where comment_id = new.id
      )
  loop
    insert into notifications (user_id, event_type, type, message, link, brief_id, brief_name)
    values (
      subscriber_uid,
      'new_comment',
      'comment',
      actor_name || ' commented on "' || coalesce(brief_name, 'a brief') || '"',
      '/trello?briefId=' || new.brief_id::text,
      new.brief_id,
      brief_name
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment on brief_comments;
create trigger trg_notify_on_comment
  after insert on brief_comments
  for each row execute procedure notify_on_comment();

-- ----- 6. Trigger: when brief pipeline_status → client_review, notify -----
create or replace function notify_on_client_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subscriber_uid uuid;
begin
  if new.pipeline_status = 'client_review'
     and coalesce(old.pipeline_status, '') <> 'client_review' then

    -- Notify all client users of this brief's client_id
    for subscriber_uid in
      select id from profiles where client_id = new.client_id and id is not null
    loop
      insert into notifications (user_id, event_type, type, message, link, brief_id, brief_name)
      values (
        subscriber_uid,
        'ready_for_review',
        'review',
        'Ready for your review: "' || coalesce(new.name, 'a brief') || '"',
        '/trello?briefId=' || new.id::text,
        new.id,
        new.name
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_client_review on briefs;
create trigger trg_notify_on_client_review
  after update on briefs
  for each row execute procedure notify_on_client_review();

-- Verification
-- select count(*) from notification_preferences;  -- should be ≥ (# profiles × 4)
-- select column_name from information_schema.columns where table_name = 'notifications' and column_name in ('user_id','event_type');
