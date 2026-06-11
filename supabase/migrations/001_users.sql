-- 001_users.sql
-- Core users table — primary identity for all actors (student, placement officer, recruiter, admin)
-- Mirrors auth.users from Supabase; id is the auth user id

create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type user_type as enum ('student', 'professional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skill_level as enum ('beginner', 'intermediate', 'advanced', 'expert');
exception when duplicate_object then null; end $$;

do $$ begin
  create type platform_role as enum ('student', 'placement_officer', 'recruiter', 'admin');
exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) not null unique,
  display_name varchar(100),
  user_type user_type not null default 'student',
  goals jsonb,
  skill_level skill_level,
  working_hours_start int check (working_hours_start between 0 and 23),
  working_hours_end int check (working_hours_end between 0 and 23),
  onboarding_step varchar(50) not null default 'signup',
  onboarding_completed_at timestamptz,
  avatar_url text,
  role platform_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint working_hours_order check (
    working_hours_start is null
    or working_hours_end is null
    or working_hours_end > working_hours_start
  )
);

create index if not exists idx_users_role on public.users (role);
create index if not exists idx_users_user_type on public.users (user_type);
create index if not exists idx_users_email on public.users (email);

-- Auto-update updated_at
create or replace function public.tg_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.tg_set_updated_at();

-- Bootstrap a users row when an auth user signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on table public.users is 'Primary identity for all platform actors. Mirrors auth.users.';
