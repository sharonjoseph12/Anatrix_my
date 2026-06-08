-- 005_skills.sql
-- Skills catalog and per-user verified skill proof

do $$ begin
  create type proficiency_level as enum ('novice', 'developing', 'proficient', 'advanced', 'expert');
exception when duplicate_object then null; end $$;

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null unique,
  slug varchar(120) not null unique,
  category varchar(50) not null,
  difficulty_level int not null check (difficulty_level between 1 and 10),
  industry_demand int not null check (industry_demand between 1 and 10),
  avg_hours_to_proficiency int check (avg_hours_to_proficiency >= 0),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_skills_category on public.skills (category);
create index if not exists idx_skills_slug on public.skills (slug);

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  hours_logged int not null default 0 check (hours_logged >= 0),
  projects_completed int not null default 0 check (projects_completed >= 0),
  avg_completion_rate numeric(4,2) check (avg_completion_rate is null or avg_completion_rate between 0 and 1),
  avg_focus_quality numeric(4,2) check (avg_focus_quality is null or avg_focus_quality between 0 and 1),
  hours_score numeric(5,2),
  projects_score numeric(5,2),
  quality_score numeric(5,2),
  consistency_score numeric(5,2),
  skill_proof_score int not null default 0 check (skill_proof_score between 0 and 100),
  proficiency_level proficiency_level not null default 'novice',
  last_project_date date,
  validated_by_institution boolean not null default false,
  last_calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_user_skills_user_skill
  on public.user_skills (user_id, skill_id);

create index if not exists idx_user_skills_user_score
  on public.user_skills (user_id, skill_proof_score desc);

create index if not exists idx_user_skills_user_proficiency
  on public.user_skills (user_id, proficiency_level);

drop trigger if exists trg_user_skills_updated_at on public.user_skills;
create trigger trg_user_skills_updated_at before update on public.user_skills
  for each row execute function public.tg_set_updated_at();

comment on table public.skills is 'Master catalog of skills. Seeded in seed.sql.';
comment on table public.user_skills is 'Verified skill proof per user. skill_proof_score is a weighted 0-100 composite.';
