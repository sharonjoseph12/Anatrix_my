-- 014_company_intake.sql
-- Open positions companies are hiring for, used by the company search/match flow.

do $$ begin
  create type position_status as enum ('open', 'paused', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists public.intake_positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title varchar(255) not null,
  description text,
  required_skills jsonb not null default '[]'::jsonb, -- [ { skill_slug, min_score } ]
  min_skill_proof_score int not null default 0 check (min_skill_proof_score between 0 and 100),
  min_hours_logged int default 0,
  preferred_locations jsonb,
  preferred_batch_years jsonb,
  min_focus_quality numeric(4,2) default 0,
  status position_status not null default 'open',
  openings int not null default 1 check (openings > 0),
  posted_at timestamptz not null default now(),
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_intake_positions_company on public.intake_positions (company_id);
create index if not exists idx_intake_positions_status on public.intake_positions (status) where status = 'open';

drop trigger if exists trg_intake_positions_updated_at on public.intake_positions;
create trigger trg_intake_positions_updated_at before update on public.intake_positions
  for each row execute function public.tg_set_updated_at();

-- Helpful view: companies + their open position count
create or replace view public.companies_with_open_positions as
select
  c.*,
  coalesce(
    (select count(*) from public.intake_positions p where p.company_id = c.id and p.status = 'open'),
    0
  ) as open_positions_count
from public.companies c;

comment on table public.intake_positions is 'Open roles a company is hiring for, used by search + auto-match.';
