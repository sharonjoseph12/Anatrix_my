-- 022_credentials.sql
-- T015 — verifiable_credentials, credential_distributions
-- See spec/002 A-014 for the snapshot-refresh threshold

do $$ begin
  create type credential_channel as enum ('link', 'pdf', 'qr', 'linkedin_badge');
exception when duplicate_object then null; end $$;
do $$ begin
  create type revocation_status as enum ('active', 'revoked');
exception when duplicate_object then null; end $$;

create table if not exists public.verifiable_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  public_slug varchar(32) not null unique,
  snapshot_overall_score int not null,
  snapshot_per_skill jsonb,
  snapshot_activity_totals jsonb,
  snapshot_cohort_percentile int,
  snapshot_taken_at timestamptz not null,
  last_verified_at timestamptz,
  verification_count bigint not null default 0,
  revocation_status revocation_status not null default 'active',
  revoked_at timestamptz,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists verifiable_credentials_slug_idx on public.verifiable_credentials(public_slug);

create table if not exists public.credential_distributions (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.verifiable_credentials(id) on delete cascade,
  channel credential_channel not null,
  generated_at timestamptz not null default now(),
  artifact_url text,
  unique (credential_id, channel)
);
