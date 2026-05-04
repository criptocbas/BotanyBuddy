-- ===========================================================================
-- Grok Garden — Supabase schema
-- Run this in Supabase SQL editor (or via `supabase db push`).
-- It is idempotent: safe to re-run.
-- ===========================================================================

-- Required extensions
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-insert a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- plants
-- ---------------------------------------------------------------------------
create table if not exists public.plants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  species text,
  pot_type text,           -- e.g. "terracotta", "plastic", "ceramic"
  drainage boolean not null default true,
  light text,              -- e.g. "bright indirect"
  location text,           -- e.g. "kitchen window"
  notes text,
  cover_photo_url text,    -- denormalized: URL of latest/preferred photo
  watering_interval_days int,            -- user-set, optional
  fertilizing_interval_days int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plants_user_idx on public.plants(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- plant_photos
-- ---------------------------------------------------------------------------
create table if not exists public.plant_photos (
  id uuid primary key default uuid_generate_v4(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,   -- path in the 'plant-photos' bucket
  url text not null,            -- public/signed URL
  caption text,
  uploaded_at timestamptz not null default now()
);

create index if not exists plant_photos_plant_idx on public.plant_photos(plant_id, uploaded_at desc);

-- ---------------------------------------------------------------------------
-- care_logs
-- ---------------------------------------------------------------------------
do $$ begin
  create type care_action as enum ('water','fertilize','repot','prune','mist','rotate','observation','other');
exception when duplicate_object then null; end $$;

create table if not exists public.care_logs (
  id uuid primary key default uuid_generate_v4(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type care_action not null,
  acted_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists care_logs_plant_idx on public.care_logs(plant_id, acted_at desc);

-- ---------------------------------------------------------------------------
-- grok_advice: persisted Grok analyses for each photo / request
-- ---------------------------------------------------------------------------
create table if not exists public.grok_advice (
  id uuid primary key default uuid_generate_v4(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_id uuid references public.plant_photos(id) on delete set null,
  summary text,
  status text,              -- e.g. "Healthy", "Needs water soon", "Concern"
  next_action text,         -- short single line
  next_action_at timestamptz,
  raw jsonb,                -- full structured response from Grok
  model text,
  created_at timestamptz not null default now()
);

create index if not exists grok_advice_plant_idx on public.grok_advice(plant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_touch_plants on public.plants;
create trigger trg_touch_plants before update on public.plants
  for each row execute procedure public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.plants        enable row level security;
alter table public.plant_photos  enable row level security;
alter table public.care_logs     enable row level security;
alter table public.grok_advice   enable row level security;

-- profiles
drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- plants / photos / logs / advice: owner-only
do $$
declare t text;
begin
  for t in select unnest(array['plants','plant_photos','care_logs','grok_advice']) loop
    execute format('drop policy if exists "%1$s owner all" on public.%1$s', t);
    execute format(
      'create policy "%1$s owner all" on public.%1$s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket for plant photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do nothing;

-- Owner-only write policies on storage objects.
-- Photos live under <user_id>/<plant_id>/<filename>.
drop policy if exists "plant photos read" on storage.objects;
create policy "plant photos read" on storage.objects
  for select using (bucket_id = 'plant-photos');

drop policy if exists "plant photos write" on storage.objects;
create policy "plant photos write" on storage.objects
  for insert with check (
    bucket_id = 'plant-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "plant photos update own" on storage.objects;
create policy "plant photos update own" on storage.objects
  for update using (
    bucket_id = 'plant-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "plant photos delete own" on storage.objects;
create policy "plant photos delete own" on storage.objects
  for delete using (
    bucket_id = 'plant-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Convenience view: latest advice + last care timestamps per plant. The
-- dashboard reads from this view alone — no separate care_logs roundtrip.
--
-- Drop-then-create instead of `create or replace`: when columns are added
-- to `plants` later (e.g. last_water_due_notified_at), `select p.*` shifts
-- the column order and `create or replace view` refuses to update it.
-- ---------------------------------------------------------------------------
drop view if exists public.plants_with_status;
create view public.plants_with_status as
select
  p.*,
  ga.id             as latest_advice_id,
  ga.status         as latest_status,
  ga.summary        as latest_summary,
  ga.next_action    as latest_next_action,
  ga.next_action_at as latest_next_action_at,
  ga.created_at     as latest_advice_at,
  lw.acted_at       as last_watered_at,
  lf.acted_at       as last_fertilized_at
from public.plants p
left join lateral (
  select * from public.grok_advice
  where plant_id = p.id
  order by created_at desc
  limit 1
) ga on true
left join lateral (
  select acted_at from public.care_logs
  where plant_id = p.id and action_type = 'water'
  order by acted_at desc
  limit 1
) lw on true
left join lateral (
  select acted_at from public.care_logs
  where plant_id = p.id and action_type = 'fertilize'
  order by acted_at desc
  limit 1
) lf on true;

grant select on public.plants_with_status to authenticated;

-- ===========================================================================
-- v2 additions: chat threads, push notifications, reminder bookkeeping
-- (Idempotent — safe to re-run.)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- chat_messages: per-plant conversation thread with Grok
-- ---------------------------------------------------------------------------
do $$ begin
  create type chat_role as enum ('user','assistant','system');
exception when duplicate_object then null; end $$;

create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role chat_role not null,
  content text not null,
  photo_id uuid references public.plant_photos(id) on delete set null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_plant_idx
  on public.chat_messages(plant_id, created_at asc);

alter table public.chat_messages enable row level security;
drop policy if exists "chat_messages owner all" on public.chat_messages;
create policy "chat_messages owner all" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- push_subscriptions: one row per browser/device that opted in
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions owner all" on public.push_subscriptions;
create policy "push_subscriptions owner all" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reminder bookkeeping: mark advice rows as already-notified so the cron
-- doesn't re-spam, and keep a watering-due notified-at on plants.
-- ---------------------------------------------------------------------------
alter table public.grok_advice
  add column if not exists notified_at timestamptz;

alter table public.plants
  add column if not exists last_water_due_notified_at timestamptz;

create index if not exists grok_advice_due_idx
  on public.grok_advice(next_action_at)
  where notified_at is null and next_action_at is not null;

-- ---------------------------------------------------------------------------
-- Helper view: rows the reminder cron should consider sending right now.
-- Combines (a) any unnotified Grok next-actions whose time has come and
-- (b) any plants that are past due based on watering interval.
-- ---------------------------------------------------------------------------
create or replace view public.due_reminders as
-- (a) Grok-recommended next actions
select
  ga.user_id,
  ga.plant_id,
  p.name           as plant_name,
  ga.next_action   as title,
  'grok'           as source,
  ga.id            as advice_id
from public.grok_advice ga
join public.plants p on p.id = ga.plant_id
where ga.notified_at is null
  and ga.next_action_at is not null
  and ga.next_action_at <= now()
union all
-- (b) Watering past due based on last water + interval
select
  p.user_id,
  p.id              as plant_id,
  p.name            as plant_name,
  'Time to water ' || p.name as title,
  'water'           as source,
  null::uuid        as advice_id
from public.plants p
left join lateral (
  select acted_at from public.care_logs
  where plant_id = p.id and action_type = 'water'
  order by acted_at desc limit 1
) lw on true
where p.watering_interval_days is not null
  and lw.acted_at is not null
  and lw.acted_at + (p.watering_interval_days || ' days')::interval <= now()
  and (
    p.last_water_due_notified_at is null
    or p.last_water_due_notified_at < lw.acted_at
  );

grant select on public.due_reminders to service_role;

