-- 003_github.sql
-- GitHub OAuth accounts and synced commit activity

do $$ begin
  create type github_account_status as enum ('active', 'disconnected', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists public.github_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  github_id bigint not null,
  username varchar(100) not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  scope varchar(255),
  status github_account_status not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_github_accounts_github_id
  on public.github_accounts (github_id);

drop trigger if exists trg_github_accounts_updated_at on public.github_accounts;
create trigger trg_github_accounts_updated_at before update on public.github_accounts
  for each row execute function public.tg_set_updated_at();

create table if not exists public.github_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  github_account_id uuid not null references public.github_accounts(id) on delete cascade,
  commit_hash varchar(40) not null,
  repo_name varchar(255) not null,
  repo_full_name varchar(255) not null,
  primary_language varchar(50),
  files_changed int,
  additions int,
  deletions int,
  message text,
  committed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_github_activity_user_commit
  on public.github_activity (user_id, commit_hash);

create index if not exists idx_github_activity_user_committed
  on public.github_activity (user_id, committed_at desc);

create index if not exists idx_github_activity_user_lang
  on public.github_activity (user_id, primary_language);

comment on table public.github_accounts is 'Per-user GitHub OAuth connection. access_token is encrypted at rest.';
comment on table public.github_activity is 'Synced commit data. Unique on (user_id, commit_hash) for idempotent sync.';
