-- 010_rls_policies.sql
-- Row Level Security for all tables per data-model.md

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.github_accounts enable row level security;
alter table public.github_activity enable row level security;
alter table public.calendar_accounts enable row level security;
alter table public.calendar_events enable row level security;
alter table public.user_skills enable row level security;
alter table public.insights enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;
alter table public.institutions enable row level security;
alter table public.institution_members enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.recruiter_searches enable row level security;
alter table public.job_matches enable row level security;
alter table public.skills enable row level security;

-- Helper: is the current user a placement officer for an institution?
create or replace function public.is_placement_officer_for(inst_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.institution_members
    where institution_id = inst_id
      and user_id = auth.uid()
      and role = 'placement_officer'
  );
$$;

-- Helper: is the current user a recruiter for a company?
create or replace function public.is_recruiter_for(comp_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = comp_id
      and user_id = auth.uid()
  );
$$;

-- =============================================================================
-- users
-- =============================================================================
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users
  for select using (auth.uid() = id);

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Service role can insert (handle_new_user trigger)
drop policy if exists users_service_insert on public.users;
create policy users_service_insert on public.users
  for insert with check (true);

-- =============================================================================
-- sessions
-- =============================================================================
drop policy if exists sessions_self_read on public.sessions;
create policy sessions_self_read on public.sessions
  for select using (auth.uid() = user_id);

drop policy if exists sessions_self_insert on public.sessions;
create policy sessions_self_insert on public.sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists sessions_self_update on public.sessions;
create policy sessions_self_update on public.sessions
  for update using (auth.uid() = user_id);

drop policy if exists sessions_self_delete on public.sessions;
create policy sessions_self_delete on public.sessions
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- github_accounts
-- =============================================================================
drop policy if exists github_accounts_self_all on public.github_accounts;
create policy github_accounts_self_all on public.github_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- github_activity
-- =============================================================================
drop policy if exists github_activity_self_read on public.github_activity;
create policy github_activity_self_read on public.github_activity
  for select using (auth.uid() = user_id);

drop policy if exists github_activity_self_insert on public.github_activity;
create policy github_activity_self_insert on public.github_activity
  for insert with check (auth.uid() = user_id);

-- =============================================================================
-- calendar_accounts
-- =============================================================================
drop policy if exists calendar_accounts_self_all on public.calendar_accounts;
create policy calendar_accounts_self_all on public.calendar_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- calendar_events
-- =============================================================================
drop policy if exists calendar_events_self_read on public.calendar_events;
create policy calendar_events_self_read on public.calendar_events
  for select using (auth.uid() = user_id);

drop policy if exists calendar_events_self_insert on public.calendar_events;
create policy calendar_events_self_insert on public.calendar_events
  for insert with check (auth.uid() = user_id);

-- =============================================================================
-- skills — public read
-- =============================================================================
drop policy if exists skills_public_read on public.skills;
create policy skills_public_read on public.skills
  for select using (true);

-- =============================================================================
-- user_skills
-- =============================================================================
drop policy if exists user_skills_self_read on public.user_skills;
create policy user_skills_self_read on public.user_skills
  for select using (auth.uid() = user_id);

drop policy if exists user_skills_self_write on public.user_skills;
create policy user_skills_self_write on public.user_skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recruiters can read scores of public, open-to-opportunities candidates
drop policy if exists user_skills_recruiter_read on public.user_skills;
create policy user_skills_recruiter_read on public.user_skills
  for select using (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.user_id = user_skills.user_id
        and cp.is_public = true
        and cp.is_open_to_opportunities = true
    )
  );

-- =============================================================================
-- insights
-- =============================================================================
drop policy if exists insights_self_read on public.insights;
create policy insights_self_read on public.insights
  for select using (auth.uid() = user_id);

drop policy if exists insights_self_write on public.insights;
create policy insights_self_write on public.insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- cohorts
-- =============================================================================
drop policy if exists cohorts_public_read on public.cohorts;
create policy cohorts_public_read on public.cohorts
  for select using (is_public = true);

drop policy if exists cohorts_member_read on public.cohorts;
create policy cohorts_member_read on public.cohorts
  for select using (
    exists (
      select 1 from public.cohort_members
      where cohort_id = cohorts.id and user_id = auth.uid()
    )
  );

drop policy if exists cohorts_member_insert on public.cohorts;
create policy cohorts_member_insert on public.cohorts
  for insert with check (auth.uid() = created_by);

drop policy if exists cohorts_creator_update on public.cohorts;
create policy cohorts_creator_update on public.cohorts
  for update using (auth.uid() = created_by);

-- =============================================================================
-- cohort_members
-- =============================================================================
drop policy if exists cohort_members_read on public.cohort_members;
create policy cohort_members_read on public.cohort_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.cohorts c
      where c.id = cohort_members.cohort_id and c.is_public = true
    )
  );

drop policy if exists cohort_members_self_insert on public.cohort_members;
create policy cohort_members_self_insert on public.cohort_members
  for insert with check (user_id = auth.uid());

drop policy if exists cohort_members_self_delete on public.cohort_members;
create policy cohort_members_self_delete on public.cohort_members
  for delete using (user_id = auth.uid());

-- =============================================================================
-- institutions
-- =============================================================================
drop policy if exists institutions_read on public.institutions;
create policy institutions_read on public.institutions
  for select using (
    exists (
      select 1 from public.institution_members
      where institution_id = institutions.id and user_id = auth.uid()
    )
  );

drop policy if exists institutions_insert on public.institutions;
create policy institutions_insert on public.institutions
  for insert with check (true);

drop policy if exists institutions_admin_update on public.institutions;
create policy institutions_admin_update on public.institutions
  for update using (
    exists (
      select 1 from public.institution_members
      where institution_id = institutions.id
        and user_id = auth.uid()
        and role in ('placement_officer', 'admin')
    )
  );

-- =============================================================================
-- institution_members
-- =============================================================================
drop policy if exists institution_members_read on public.institution_members;
create policy institution_members_read on public.institution_members
  for select using (
    user_id = auth.uid()
    or public.is_placement_officer_for(institution_id)
  );

drop policy if exists institution_members_write on public.institution_members;
create policy institution_members_write on public.institution_members
  for all using (public.is_placement_officer_for(institution_id))
  with check (public.is_placement_officer_for(institution_id));

-- =============================================================================
-- companies
-- =============================================================================
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies
  for select using (public.is_recruiter_for(id));

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert with check (true);

drop policy if exists companies_admin_update on public.companies;
create policy companies_admin_update on public.companies
  for update using (public.is_recruiter_for(id));

-- =============================================================================
-- company_members
-- =============================================================================
drop policy if exists company_members_read on public.company_members;
create policy company_members_read on public.company_members
  for select using (
    user_id = auth.uid() or public.is_recruiter_for(company_id)
  );

drop policy if exists company_members_write on public.company_members;
create policy company_members_write on public.company_members
  for all using (public.is_recruiter_for(company_id))
  with check (public.is_recruiter_for(company_id));

-- =============================================================================
-- candidate_profiles
-- =============================================================================
drop policy if exists candidate_profiles_self_read on public.candidate_profiles;
create policy candidate_profiles_self_read on public.candidate_profiles
  for select using (auth.uid() = user_id);

drop policy if exists candidate_profiles_self_write on public.candidate_profiles;
create policy candidate_profiles_self_write on public.candidate_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recruiters see public, open-to-opportunities profiles
drop policy if exists candidate_profiles_recruiter_read on public.candidate_profiles;
create policy candidate_profiles_recruiter_read on public.candidate_profiles
  for select using (
    is_public = true
    and is_open_to_opportunities = true
    and exists (
      select 1 from public.company_members
      where user_id = auth.uid()
    )
  );

-- Placement officers see their own institution's profiles
drop policy if exists candidate_profiles_officer_read on public.candidate_profiles;
create policy candidate_profiles_officer_read on public.candidate_profiles
  for select using (
    institution_id is not null
    and public.is_placement_officer_for(institution_id)
  );

-- =============================================================================
-- recruiter_searches
-- =============================================================================
drop policy if exists recruiter_searches_all on public.recruiter_searches;
create policy recruiter_searches_all on public.recruiter_searches
  for all using (public.is_recruiter_for(company_id))
  with check (public.is_recruiter_for(company_id));

-- =============================================================================
-- job_matches
-- =============================================================================
drop policy if exists job_matches_recruiter_read on public.job_matches;
create policy job_matches_recruiter_read on public.job_matches
  for select using (public.is_recruiter_for(company_id));

drop policy if exists job_matches_recruiter_write on public.job_matches;
create policy job_matches_recruiter_write on public.job_matches
  for all using (public.is_recruiter_for(company_id))
  with check (public.is_recruiter_for(company_id));

drop policy if exists job_matches_candidate_read on public.job_matches;
create policy job_matches_candidate_read on public.job_matches
  for select using (
    exists (
      select 1 from public.candidate_profiles cp
      where cp.id = job_matches.candidate_id and cp.user_id = auth.uid()
    )
  );
