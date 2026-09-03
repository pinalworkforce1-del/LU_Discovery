-- Level Up shared participant record and module journey storage.
-- Run this entire file once in Supabase SQL Editor.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'participant' check (role in ('participant', 'coach', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.module_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  journey_state jsonb not null default '{}'::jsonb,
  xp integer not null default 0 check (xp >= 0),
  is_complete boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

alter table public.profiles enable row level security;
alter table public.module_progress enable row level security;

drop policy if exists "Participants can view their profile" on public.profiles;
create policy "Participants can view their profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Participants can update their profile" on public.profiles;
create policy "Participants can update their profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Participants can view their module progress" on public.module_progress;
create policy "Participants can view their module progress"
on public.module_progress for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Participants can create their module progress" on public.module_progress;
create policy "Participants can create their module progress"
on public.module_progress for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Participants can update their module progress" on public.module_progress;
create policy "Participants can update their module progress"
on public.module_progress for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists module_progress_touch_updated_at on public.module_progress;
create trigger module_progress_touch_updated_at
  before update on public.module_progress
  for each row execute procedure public.touch_updated_at();

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.module_progress to authenticated;
