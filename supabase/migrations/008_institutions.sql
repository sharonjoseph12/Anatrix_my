-- 008_institutions.sql
-- Colleges, universities, bootcamps — placement officer portal

do $$ begin
  create type institution_type as enum ('college', 'university', 'bootcamp', 'corporate_training');
exception when duplicate_object then null; end $$;

do $$ begin
  create type institution_role as enum ('student', 'faculty', 'admin', 'placement_officer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type institution_tier as enum ('starter', 'growth', 'enterprise');
exception when duplicate_object then null; end $$;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  type institution_type not null,
  location varchar(255),
  city varchar(100),
  country varchar(100) not null default 'India',
  subscription_tier institution_tier not null default 'starter',
  subscription_start_date date,
  annual_cost int check (annual_cost is null or annual_cost >= 0),
  total_students int not null default 0,
  tracked_students int not null default 0,
  placement_rate numeric(4,2) check (placement_rate is null or placement_rate between 0 and 1),
  avg_skill_proof_score int check (avg_skill_proof_score is null or avg_skill_proof_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_institutions_type on public.institutions (type);
create index if not exists idx_institutions_city on public.institutions (city);

drop trigger if exists trg_institutions_updated_at on public.institutions;
create trigger trg_institutions_updated_at before update on public.institutions
  for each row execute function public.tg_set_updated_at();

create table if not exists public.institution_members (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role institution_role not null default 'student',
  batch_year int,
  department varchar(100),
  roll_number varchar(50),
  specialization varchar(100),
  joined_at timestamptz not null default now()
);

create unique index if not exists uq_institution_members_inst_user
  on public.institution_members (institution_id, user_id);

create index if not exists idx_institution_members_inst_batch
  on public.institution_members (institution_id, batch_year);

create index if not exists idx_institution_members_user
  on public.institution_members (user_id);

comment on table public.institutions is 'Colleges and universities using the placement dashboard.';
comment on table public.institution_members is 'User membership in institutions (student/faculty/placement_officer).';
