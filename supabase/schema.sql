-- NutriGlass AI food diary database
-- Run this whole file in Supabase Dashboard > SQL Editor.
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  portion text not null default 'Portion not specified',
  calories integer not null default 0 check (calories >= 0 and calories <= 10000),
  logged_date date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_date_idx
  on public.food_logs (user_id, logged_date, created_at desc);

alter table public.food_logs enable row level security;
revoke all on table public.food_logs from anon, authenticated;
grant select, insert, delete on table public.food_logs to authenticated;

drop policy if exists "Users can read own food logs" on public.food_logs;
create policy "Users can read own food logs"
  on public.food_logs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own food logs" on public.food_logs;
create policy "Users can insert own food logs"
  on public.food_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own food logs" on public.food_logs;
create policy "Users can delete own food logs"
  on public.food_logs for delete to authenticated
  using ((select auth.uid()) = user_id);


-- Automatically store every successful AI scan, even before the user adds it to the food diary.
create table if not exists public.food_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  portion_estimate text not null default 'Not specified',
  calorie_min integer not null default 0 check (calorie_min >= 0 and calorie_min <= 5000),
  calorie_max integer not null default 0 check (calorie_max >= calorie_min and calorie_max <= 5000),
  confidence text not null default 'unknown' check (confidence in ('high','medium','low','unknown')),
  basis text not null default '',
  suggestion text not null default '',
  scanned_at timestamptz not null default now()
);
create index if not exists food_scans_user_time_idx on public.food_scans(user_id, scanned_at desc);
alter table public.food_scans enable row level security;
revoke all on table public.food_scans from anon, authenticated;
grant select, insert, delete on table public.food_scans to authenticated;
drop policy if exists "Users can read own food scans" on public.food_scans;
create policy "Users can read own food scans" on public.food_scans for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own food scans" on public.food_scans;
create policy "Users can insert own food scans" on public.food_scans for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own food scans" on public.food_scans;
create policy "Users can delete own food scans" on public.food_scans for delete to authenticated using ((select auth.uid()) = user_id);
