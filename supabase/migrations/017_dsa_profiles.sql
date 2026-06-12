-- supabase/migrations/017_dsa_profiles.sql
-- T005/T006 — DSA sync tables (user_dsa_profiles) and slug history
-- (slug_redirects) with a trigger that writes history when a student
-- changes their public-profile slug.

create table if not exists public.user_dsa_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('leetcode', 'hackerrank')),
  username text not null check (length(username) between 2 and 30),
  total_solved integer not null default 0,
  easy_solved integer not null default 0,
  medium_solved integer not null default 0,
  hard_solved integer not null default 0,
  contest_rating integer,
  streak_days integer not null default 0,
  badges jsonb not null default '[]'::jsonb,
  last_active_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'active'
    check (sync_status in ('active', 'rate_limited', 'private', 'not_found', 'error', 'pending')),
  created_at timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists idx_user_dsa_user_platform
  on public.user_dsa_profiles (user_id, platform);

create index if not exists idx_user_dsa_sync_due
  on public.user_dsa_profiles (last_synced_at)
  where sync_status = 'active';

alter table public.user_dsa_profiles enable row level security;

drop policy if exists user_dsa_profiles_select_self on public.user_dsa_profiles;
create policy user_dsa_profiles_select_self on public.user_dsa_profiles
  for select using (auth.uid() = user_id);

-- Public visibility: anyone can read profiles linked to a public candidate.
drop policy if exists user_dsa_profiles_select_public on public.user_dsa_profiles;
create policy user_dsa_profiles_select_public on public.user_dsa_profiles
  for select using (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.user_id = user_dsa_profiles.user_id and cp.is_public = true
    )
  );

-- Writes go through service role (dsa-sync edge function).
-- Allow self-insert/upsert from the client (connect endpoint) for v1.
drop policy if exists user_dsa_profiles_insert_self on public.user_dsa_profiles;
create policy user_dsa_profiles_insert_self on public.user_dsa_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists user_dsa_profiles_update_self on public.user_dsa_profiles;
create policy user_dsa_profiles_update_self on public.user_dsa_profiles
  for update using (auth.uid() = user_id);

drop policy if exists user_dsa_profiles_delete_self on public.user_dsa_profiles;
create policy user_dsa_profiles_delete_self on public.user_dsa_profiles
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Slug history (FR-015 — 90-day 301 redirects)
-- =============================================================================
create table if not exists public.slug_redirects (
  id uuid primary key default gen_random_uuid(),
  old_slug text not null unique,
  new_slug text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);

create index if not exists idx_slug_redirects_active
  on public.slug_redirects (old_slug);

alter table public.slug_redirects enable row level security;

-- Slug history is server-managed; no client policies.

-- Trigger: when candidate_profiles.slug changes, write a redirect.
create or replace function public.record_slug_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'UPDATE' and new.slug is distinct from old.slug) then
    if old.slug is not null and new.slug is not null then
      insert into public.slug_redirects (old_slug, new_slug, user_id)
      values (old.slug, new.slug, new.user_id)
      on conflict (old_slug) do update
        set new_slug = excluded.new_slug,
            user_id = excluded.user_id,
            expires_at = now() + interval '90 days';
    end if;
  end if;
  return new;
end;
$$;

-- Add slug column to candidate_profiles if it doesn't exist
alter table public.candidate_profiles add column if not exists slug text unique;

drop trigger if exists trg_candidate_profiles_slug_change on public.candidate_profiles;
create trigger trg_candidate_profiles_slug_change
  before update of slug on public.candidate_profiles
  for each row execute function public.record_slug_change();
