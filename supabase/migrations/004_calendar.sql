-- 004_calendar.sql
-- Google Calendar OAuth and synced events

do $$ begin
  create type calendar_provider as enum ('google', 'microsoft');
exception when duplicate_object then null; end $$;

do $$ begin
  create type calendar_account_status as enum ('active', 'disconnected', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider calendar_provider not null default 'google',
  email varchar(255) not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  status calendar_account_status not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_calendar_accounts_updated_at on public.calendar_accounts;
create trigger trg_calendar_accounts_updated_at before update on public.calendar_accounts
  for each row execute function public.tg_set_updated_at();

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  calendar_account_id uuid not null references public.calendar_accounts(id) on delete cascade,
  event_id varchar(255) not null,
  title varchar(255),
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  event_type varchar(50),
  is_focused boolean default false,
  category session_category,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_calendar_events_user_event
  on public.calendar_events (user_id, event_id);

create index if not exists idx_calendar_events_user_start
  on public.calendar_events (user_id, start_at desc);

comment on table public.calendar_accounts is 'Per-user Google/Microsoft Calendar OAuth. Tokens encrypted at rest.';
comment on table public.calendar_events is 'Synced calendar events. Unique on (user_id, event_id) for idempotent sync.';
