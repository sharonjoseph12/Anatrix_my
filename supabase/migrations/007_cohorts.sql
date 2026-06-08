-- 007_cohorts.sql
-- Cohort groups for community comparison

do $$ begin
  create type cohort_type as enum ('institutional', 'interest', 'custom');
exception when duplicate_object then null; end $$;

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  description text,
  institution_id uuid,
  cohort_type cohort_type not null default 'custom',
  is_public boolean not null default true,
  invite_code varchar(20) unique,
  created_by uuid references public.users(id) on delete set null,
  member_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cohorts_institution on public.cohorts (institution_id);
create index if not exists idx_cohorts_type on public.cohorts (cohort_type);
create index if not exists idx_cohorts_public on public.cohorts (is_public) where is_public = true;

drop trigger if exists trg_cohorts_updated_at on public.cohorts;
create trigger trg_cohorts_updated_at before update on public.cohorts
  for each row execute function public.tg_set_updated_at();

create table if not exists public.cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now()
);

create unique index if not exists uq_cohort_members_cohort_user
  on public.cohort_members (cohort_id, user_id);

create index if not exists idx_cohort_members_user on public.cohort_members (user_id);

-- Maintain denormalized member_count
create or replace function public.tg_cohort_member_count() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.cohorts
      set member_count = member_count + 1, updated_at = now()
      where id = new.cohort_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.cohorts
      set member_count = greatest(0, member_count - 1), updated_at = now()
      where id = old.cohort_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_cohort_member_count_ins on public.cohort_members;
create trigger trg_cohort_member_count_ins
  after insert on public.cohort_members
  for each row execute function public.tg_cohort_member_count();

drop trigger if exists trg_cohort_member_count_del on public.cohort_members;
create trigger trg_cohort_member_count_del
  after delete on public.cohort_members
  for each row execute function public.tg_cohort_member_count();

comment on table public.cohorts is 'Student groups for comparison and community.';
comment on table public.cohort_members is 'Cohort membership. member_count on cohorts is auto-maintained.';
