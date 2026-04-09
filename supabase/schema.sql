-- Caravan Marketing Command Center – Database Schema
-- Run this in the Supabase SQL editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- 1. SHOWS
-- ─────────────────────────────────────────
create table if not exists shows (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  start_date    date not null,
  end_date      date not null,
  location      text not null,
  site_number   text,
  brands        text[] not null default '{}',
  website_url   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shows_updated_at
  before update on shows
  for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────
-- 2. DELIVERABLES CONFIG  (template list)
-- ─────────────────────────────────────────
create table if not exists deliverables_config (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  days_before_show integer not null,
  created_at    timestamptz not null default now()
);

-- Seed default deliverables
insert into deliverables_config (name, days_before_show) values
  ('Show Announcement EDM',      14),
  ('Reminder EDM',                7),
  ('SMS Campaign',                7),
  ('Social Media Posts',          7),
  ('Trello Brief Package',       22),
  ('Print Assets',               28),
  ('Google Ads Setup',           10)
on conflict do nothing;

-- ─────────────────────────────────────────
-- 3. MARKETING TASKS
-- ─────────────────────────────────────────
create table if not exists marketing_tasks (
  id             uuid primary key default uuid_generate_v4(),
  show_id        uuid not null references shows(id) on delete cascade,
  task_name      text not null,
  due_date       date not null,
  trello_card_id text,
  status         text not null default 'pending'
                   check (status in ('pending','urgent','in_progress','done')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger marketing_tasks_updated_at
  before update on marketing_tasks
  for each row execute procedure update_updated_at();

-- Index for fast lookups
create index if not exists idx_marketing_tasks_show_id on marketing_tasks(show_id);
create index if not exists idx_marketing_tasks_due_date  on marketing_tasks(due_date);

-- ─────────────────────────────────────────
-- 4. ROW-LEVEL SECURITY (basic – tighten per your auth setup)
-- ─────────────────────────────────────────
alter table shows               enable row level security;
alter table deliverables_config enable row level security;
alter table marketing_tasks     enable row level security;

-- Allow authenticated users full access (adjust per role requirements)
create policy "authenticated_all_shows"
  on shows for all
  to authenticated
  using (true) with check (true);

create policy "authenticated_all_deliverables_config"
  on deliverables_config for all
  to authenticated
  using (true) with check (true);

create policy "authenticated_all_marketing_tasks"
  on marketing_tasks for all
  to authenticated
  using (true) with check (true);
