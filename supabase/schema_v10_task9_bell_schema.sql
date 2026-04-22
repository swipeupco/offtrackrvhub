-- ─────────────────────────────────────────
-- V10 — Notification bell UX schema support (Task 9)
-- Adds actor_id (who triggered it) and comment_id (source comment, if any)
-- so the new bell can render actor avatars and comment snippets without
-- ambiguous message-parsing.
-- ─────────────────────────────────────────

alter table notifications
  add column if not exists actor_id   uuid references profiles(id) on delete set null,
  add column if not exists comment_id uuid references brief_comments(id) on delete set null;

create index if not exists idx_notifications_actor    on notifications(actor_id);
create index if not exists idx_notifications_comment  on notifications(comment_id);

-- Update mention trigger to carry actor_id + comment_id
create or replace function notify_on_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  brief_id_val uuid;
  brief_name   text;
  actor_name   text;
  actor_uid    uuid;
begin
  select bc.brief_id, bc.user_id, coalesce(p.name, 'Someone')
    into brief_id_val, actor_uid, actor_name
    from brief_comments bc
    left join profiles p on p.id = bc.user_id
    where bc.id = new.comment_id;

  select name into brief_name from briefs where id = brief_id_val;

  insert into notifications (
    user_id, actor_id, comment_id, event_type, type,
    message, link, brief_id, brief_name
  )
  values (
    new.user_id,
    actor_uid,
    new.comment_id,
    'mentioned',
    'comment',
    actor_name || ' mentioned you on "' || coalesce(brief_name, 'a brief') || '"',
    '/trello?briefId=' || brief_id_val::text,
    brief_id_val,
    brief_name
  );

  return new;
end;
$$;

-- Update comment trigger to carry actor_id + comment_id
create or replace function notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subscriber_uid uuid;
  brief_name     text;
  actor_name     text;
begin
  select name into brief_name from briefs where id = new.brief_id;
  select coalesce(name, 'Someone') into actor_name from profiles where id = new.user_id;

  for subscriber_uid in
    select distinct uid from (
      select created_by as uid from briefs where id = new.brief_id and created_by is not null
      union
      select user_id as uid from brief_assigned_users where brief_id = new.brief_id
    ) s
    where uid is not null
      and uid <> coalesce(new.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    insert into notifications (
      user_id, actor_id, comment_id, event_type, type,
      message, link, brief_id, brief_name
    )
    values (
      subscriber_uid,
      new.user_id,
      new.id,
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

-- Update client_review trigger to carry actor_id (the user who moved it)
-- TG_OP on briefs updates doesn't give us the acting user, so we leave
-- actor_id null for automated/system transitions; client bells will
-- fall back to the brand logo avatar in that case.
create or replace function notify_on_client_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subscriber_uid uuid;
  v_client_name  text;
  v_client_slug  text;
begin
  if new.pipeline_status = 'client_review'
     and coalesce(old.pipeline_status, '') <> 'client_review' then

    select c.name, c.slug into v_client_name, v_client_slug
      from clients c where c.id = new.client_id;

    for subscriber_uid in
      select id from profiles where client_id = new.client_id and id is not null
    loop
      insert into notifications (
        user_id, event_type, type,
        message, link, brief_id, brief_name, client_name, client_slug
      )
      values (
        subscriber_uid,
        'ready_for_review',
        'review',
        'Ready for your review: "' || coalesce(new.name, 'a brief') || '"',
        '/trello?briefId=' || new.id::text,
        new.id,
        new.name,
        v_client_name,
        v_client_slug
      );
    end loop;
  end if;
  return new;
end;
$$;
