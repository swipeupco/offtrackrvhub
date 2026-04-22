-- ─────────────────────────────────────────
-- V9 — Notification pipeline fix (Task 8 remediation)
-- Run in Supabase SQL Editor.
--
-- Root cause: every trigger function that inserts into notifications
-- references columns brief_name / client_name / client_slug which were
-- never added to the notifications table. The AFTER INSERT trigger on
-- comment_mentions therefore raised and rolled back every comment_mentions
-- insert, silently — the app doesn't check the .error on that supabase
-- call, so the frontend appeared to succeed while the DB discarded the
-- mention row. The pre-existing notify_on_approved / notify_on_revisions
-- triggers also failed for the same reason.
-- ─────────────────────────────────────────

-- 1. Add the denormalised columns the triggers + the Hub Notification type
--    already expect. Nullable so historical rows aren't invalidated.
alter table notifications
  add column if not exists brief_name   text,
  add column if not exists client_name  text,
  add column if not exists client_slug  text;

-- 2. Fan out notify_on_approved / notify_on_revisions per user and populate
--    user_id + event_type, so the bell + email pipeline can actually deliver
--    them. Previously they inserted a single row with user_id=null that the
--    RLS scoping hides from everyone.
create or replace function notify_on_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_client_slug text;
  subscriber_uid uuid;
begin
  if old.pipeline_status is not distinct from new.pipeline_status then return new; end if;
  if new.pipeline_status <> 'approved' then return new; end if;

  select c.name, c.slug into v_client_name, v_client_slug
    from clients c where c.id = new.client_id;

  for subscriber_uid in
    select distinct uid from (
      select id as uid from profiles where client_id = new.client_id
      union
      select created_by as uid from briefs where id = new.id and created_by is not null
      union
      select user_id as uid from brief_assigned_users where brief_id = new.id
    ) s
    where uid is not null
  loop
    insert into notifications (user_id, event_type, type, brief_id, brief_name, client_name, client_slug, message, link)
    values (
      subscriber_uid,
      'status_change',
      'brief_approved',
      new.id,
      new.name,
      v_client_name,
      v_client_slug,
      '"' || new.name || '" was approved',
      '/trello?briefId=' || new.id::text
    );
  end loop;
  return new;
end;
$$;

create or replace function notify_on_revisions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_client_slug text;
  subscriber_uid uuid;
begin
  if old.internal_status is not distinct from new.internal_status then return new; end if;
  if new.internal_status <> 'revisions_required' then return new; end if;

  select c.name, c.slug into v_client_name, v_client_slug
    from clients c where c.id = new.client_id;

  for subscriber_uid in
    select distinct uid from (
      select created_by as uid from briefs where id = new.id and created_by is not null
      union
      select user_id as uid from brief_assigned_users where brief_id = new.id
    ) s
    where uid is not null
  loop
    insert into notifications (user_id, event_type, type, brief_id, brief_name, client_name, client_slug, message, link)
    values (
      subscriber_uid,
      'status_change',
      'revisions_required',
      new.id,
      new.name,
      v_client_name,
      v_client_slug,
      '"' || new.name || '" needs revisions',
      '/trello?briefId=' || new.id::text
    );
  end loop;
  return new;
end;
$$;
