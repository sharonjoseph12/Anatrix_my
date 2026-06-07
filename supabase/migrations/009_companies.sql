-- 009_companies.sql
-- Companies, recruiter searches, candidate profiles, job matches

do $$ begin
  create type company_tier as enum ('startup', 'growth', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type company_role as enum ('admin', 'recruiter', 'hiring_manager');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_match_status as enum (
    'matched',
    'reached_out',
    'interview_scheduled',
    'interview_completed',
    'hired',
    'rejected'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  industry varchar(100),
  location varchar(255),
  city varchar(100),
  country varchar(100),
  website text,
  logo_url text,
  subscription_tier company_tier not null default 'startup',
  subscription_start_date date,
  monthly_cost int check (monthly_cost is null or monthly_cost >= 0),
  skill_preferences jsonb,
  min_skill_proof_score int default 0 check (min_skill_proof_score between 0 and 100),
  preferred_batch_years jsonb,
  preferred_locations jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_companies_tier on public.companies (subscription_tier);
create index if not exists idx_companies_industry on public.companies (industry);

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at before update on public.companies
  for each row execute function public.tg_set_updated_at();

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role company_role not null default 'recruiter',
  joined_at timestamptz not null default now()
);

create unique index if not exists uq_company_members_company_user
  on public.company_members (company_id, user_id);

create index if not exists idx_company_members_user
  on public.company_members (user_id);

create table if not exists public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  headline varchar(255),
  bio text,
  overall_skill_proof_score int not null default 0 check (overall_skill_proof_score between 0 and 100),
  primary_specialization varchar(100),
  specialization_scores jsonb,
  total_hours_logged int not null default 0,
  total_projects_completed int not null default 0,
  total_sessions int not null default 0,
  total_commits int not null default 0,
  avg_project_completion_rate numeric(4,2),
  avg_focus_quality numeric(4,2),
  peak_window jsonb,
  placement_ready boolean not null default false,
  is_public boolean not null default false,
  is_open_to_opportunities boolean not null default false,
  preferred_locations jsonb,
  preferred_role_types jsonb,
  expected_salary_min int,
  expected_salary_max int,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_candidate_profiles_score
  on public.candidate_profiles (overall_skill_proof_score desc);

create index if not exists idx_candidate_profiles_placement_ready
  on public.candidate_profiles (placement_ready)
  where placement_ready = true;

create index if not exists idx_candidate_profiles_open
  on public.candidate_profiles (is_open_to_opportunities)
  where is_open_to_opportunities = true;

create index if not exists idx_candidate_profiles_public
  on public.candidate_profiles (is_public)
  where is_public = true;

create index if not exists idx_candidate_profiles_institution
  on public.candidate_profiles (institution_id);

create table if not exists public.recruiter_searches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recruiter_id uuid not null references public.users(id) on delete cascade,
  search_name varchar(255) not null,
  skill_filters jsonb,
  min_skill_proof_score int default 0,
  batch_years jsonb,
  locations jsonb,
  results_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recruiter_searches_company
  on public.recruiter_searches (company_id);

create index if not exists idx_recruiter_searches_recruiter
  on public.recruiter_searches (recruiter_id);

drop trigger if exists trg_recruiter_searches_updated_at on public.recruiter_searches;
create trigger trg_recruiter_searches_updated_at before update on public.recruiter_searches
  for each row execute function public.tg_set_updated_at();

create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(),
  recruiter_search_id uuid references public.recruiter_searches(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  recruiter_id uuid not null references public.users(id) on delete cascade,
  position_title varchar(255),
  match_score int not null default 0 check (match_score between 0 and 100),
  skills_match int check (skills_match between 0 and 100),
  experience_match int check (experience_match between 0 and 100),
  availability_match int check (availability_match between 0 and 100),
  status job_match_status not null default 'matched',
  notes text,
  reached_out_at timestamptz,
  interview_scheduled_at timestamptz,
  interview_completed_at timestamptz,
  hired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_matches_company_status
  on public.job_matches (company_id, status);

create index if not exists idx_job_matches_candidate
  on public.job_matches (candidate_id);

create index if not exists idx_job_matches_recruiter
  on public.job_matches (recruiter_id);

drop trigger if exists trg_job_matches_updated_at on public.job_matches;
create trigger trg_job_matches_updated_at before update on public.job_matches
  for each row execute function public.tg_set_updated_at();

comment on table public.companies is 'Hiring companies. subscription_tier controls seat/feature limits.';
comment on table public.candidate_profiles is 'Denormalized searchable student record, updated daily by edge function.';
comment on table public.job_matches is 'Candidate-to-recruiter pairings with hiring pipeline state.';
