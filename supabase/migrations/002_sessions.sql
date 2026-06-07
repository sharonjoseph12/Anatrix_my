-- 002_sessions.sql
-- Tracked work sessions from the Chrome extension

do $$ begin
  create type session_category as enum ('dsa', 'coding', 'project', 'learning', 'research');
exception when duplicate_object then null; end $$;

do $$ begin
  create type focus_level as enum ('high', 'medium', 'low');
exception when duplicate_object then null; end $$;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category session_category not null,
  project_name varchar(255),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int check (duration_minutes is null or duration_minutes >= 0),
  focus_level focus_level not null default 'medium',
  focus_score numeric(4,2) check (focus_score is null or focus_score between 0 and 1),
  quality_rating int check (quality_rating between 1 and 5),
  tab_switches int default 0,
  distraction_seconds int default 0,
  extensions_used jsonb,
  notes text,
  client_id varchar(64),
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user_started
  on public.sessions (user_id, started_at desc);

create index if not exists idx_sessions_user_category
  on public.sessions (user_id, category);

create unique index if not exists uq_sessions_user_client
  on public.sessions (user_id, client_id)
  where client_id is not null;

comment on table public.sessions is 'Work sessions tracked by the Chrome extension. client_id enables idempotent sync.';
