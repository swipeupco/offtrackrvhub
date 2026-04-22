-- ─────────────────────────────────────────
-- V7 — Email delivery via Resend Edge Function (Task 6)
-- Run in Supabase SQL Editor.
--
-- Prerequisite: Schema v6 must already be applied.
-- Prerequisite: send-notification Edge Function must be deployed
--   (`supabase functions deploy send-notification`)
-- Prerequisite: RESEND_API_KEY set in the Edge Function secrets
-- ─────────────────────────────────────────

-- 1. Enable pg_net so Postgres can issue HTTP requests to the Edge Function
create extension if not exists pg_net;

-- 2. Store the Edge Function URL + anon key as GUC values so the trigger can
--    read them without hard-coding. Run these ONCE after deployment —
--    replace the placeholder values with your project's actual URL / key:
-- alter database postgres set "app.edge_functions_url" = 'https://<project-ref>.supabase.co/functions/v1';
-- alter database postgres set "app.edge_functions_anon_key" = '<anon-key>';

-- 3. Trigger: after a notification row is inserted, fire the Edge Function
create or replace function fire_email_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fn_url   text := current_setting('app.edge_functions_url', true);
  fn_key   text := current_setting('app.edge_functions_anon_key', true);
  resp_id  bigint;
begin
  -- Skip if the GUCs aren't set (e.g. local dev without Edge Function wired up)
  if fn_url is null or fn_url = '' then
    return new;
  end if;

  -- Fire-and-forget POST; pg_net queues the request asynchronously.
  select net.http_post(
    url     := fn_url || '/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(fn_key, '')
    ),
    body    := jsonb_build_object('notification_id', new.id::text)
  ) into resp_id;

  return new;
end;
$$;

drop trigger if exists trg_fire_email_notification on notifications;
create trigger trg_fire_email_notification
  after insert on notifications
  for each row execute procedure fire_email_notification();

-- 4. (Future) notification_queue + digest processor for rate limiting.
--    The initial rollout relies on user discipline + preference toggles;
--    if we observe users getting >10 emails/min we implement the queue
--    below. Leaving the DDL here commented-out so we don't create dead
--    tables.
--
-- create table if not exists notification_queue (
--   id              uuid primary key default gen_random_uuid(),
--   user_id         uuid not null references profiles(id) on delete cascade,
--   payload         jsonb not null,
--   created_at      timestamptz not null default now(),
--   processed_at    timestamptz
-- );
-- create index if not exists idx_notification_queue_pending
--   on notification_queue(user_id, created_at)
--   where processed_at is null;

-- Verification:
-- After deploying the Edge Function and setting the GUCs, insert a test
-- notification and confirm an email lands:
--
-- insert into notifications (user_id, event_type, type, message, link)
-- values ('<your-user-uuid>', 'mentioned', 'comment',
--         'Test: email delivery smoke check',
--         '/trello?briefId=<some-brief-id>');
