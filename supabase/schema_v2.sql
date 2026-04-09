-- ─────────────────────────────────────────
-- V2 additions — run in Supabase SQL Editor
-- ─────────────────────────────────────────

-- 1. VIDEO SHOOTS
create table if not exists video_shoots (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  shoot_date  date not null,
  notes       text,
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table video_shoots enable row level security;
create policy "anon_all_video_shoots" on video_shoots for all to anon using (true) with check (true);
create policy "auth_all_video_shoots" on video_shoots for all to authenticated using (true) with check (true);

-- 2. VAN INVENTORY
create table if not exists vans (
  id                uuid primary key default uuid_generate_v4(),
  model_name        text not null,
  brand             text not null,
  year              integer,
  price             numeric(10,2),
  features          text,
  image_url         text,
  footage_drive_url text,
  images_drive_url  text,
  website_url       text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger vans_updated_at
  before update on vans
  for each row execute procedure update_updated_at();

alter table vans enable row level security;
create policy "anon_all_vans" on vans for all to anon using (true) with check (true);
create policy "auth_all_vans"  on vans for all to authenticated using (true) with check (true);
