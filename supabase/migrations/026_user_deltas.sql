-- 026_user_deltas.sql
-- T019 — additive column deltas to 001 tables
-- T033 (folded) — nudge_preferences default row on users insert
-- T100 (folded) — additional 002 deltas required by the 002 Edge Functions:
--   * skill_proof_score / per_skill_scores / current_streak_days / company_search_visible
--     on candidate_profiles (the 002 functions query these names; the base
--     uses overall_skill_proof_score / specialization_scores / (none for streak)
--     and stores company_search_visible on users)
--   * student_user_id / recruiter_user_id / role_title / message / source /
--     interview_outcome on job_matches (the base uses candidate_id /
--     recruiter_id / position_title and lacks the rest)
--   * owner_user_id / plan / open_positions / search_filter on companies
--   * opted_in on institution_members

-- users
alter table public.users
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists company_search_visible boolean not null default true,
  add column if not exists power_mode_active boolean not null default false,
  add column if not exists power_mode_badge_shown_at timestamptz,
  add column if not exists placement_prediction_current_id uuid references public.placement_predictions(id),
  add column if not exists verifiable_credential_id uuid references public.verifiable_credentials(id),
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_purge_after timestamptz,
  add column if not exists full_name varchar(255),
  add column if not exists location varchar(255),
  add column if not exists last_active_at timestamptz,
  add column if not exists placement_outcome text,
  add column if not exists placement_tier text,
  add column if not exists salary_band_shared boolean not null default false,
  add column if not exists salary_band text;
create index if not exists idx_users_location on public.users (location);
create index if not exists idx_users_last_active_at on public.users (last_active_at desc);

-- github_accounts
alter table public.github_accounts
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz,
  add column if not exists scope text not null default 'public_only' check (scope in ('public_only', 'public_and_private'));

-- calendar_accounts
alter table public.calendar_accounts
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz;

-- sessions
alter table public.sessions
  add column if not exists extension_version varchar(32),
  add column if not exists sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
  add column if not exists sync_error text;

-- calendar_events
alter table public.calendar_events
  add column if not exists derived_event_type text check (derived_event_type in ('class', 'deadline', 'meeting', 'study_group', 'exam', 'other')),
  add column if not exists is_all_day boolean not null default false,
  add column if not exists attendee_count int;

-- job_matches
alter table public.job_matches
  add column if not exists interview_scheduling_state text not null default 'not_started'
    check (interview_scheduling_state in ('not_started', 'slots_proposed', 'slots_accepted', 'completed', 'declined')),
  add column if not exists student_user_id uuid references public.users(id) on delete cascade,
  add column if not exists recruiter_user_id uuid references public.users(id) on delete cascade,
  add column if not exists role_title varchar(255),
  add column if not exists message text,
  add column if not exists source text default 'antarix_search',
  add column if not exists interview_outcome text;
create index if not exists job_matches_student_user_idx
  on public.job_matches(student_user_id, created_at desc);
create index if not exists job_matches_recruiter_user_idx
  on public.job_matches(recruiter_user_id, created_at desc);

-- candidate_profiles
-- 002 functions read skill_proof_score / per_skill_scores / current_streak_days
-- from candidate_profiles. The base stores overall_skill_proof_score /
-- specialization_scores and has no streak. We add generated-column aliases
-- and a real streak column, plus a denormalised company_search_visible
-- synced from users via trigger.
alter table public.candidate_profiles
  add column if not exists last_score_change_at timestamptz,
  add column if not exists peak_window_start_local_hour smallint,
  add column if not exists peak_window_end_local_hour smallint,
  add column if not exists power_mode_bonus_active boolean not null default false,
  add column if not exists skill_proof_score int generated always as (overall_skill_proof_score) stored,
  add column if not exists per_skill_scores jsonb generated always as (specialization_scores) stored,
  add column if not exists current_streak_days int not null default 0,
  add column if not exists company_search_visible boolean not null default true;
create index if not exists candidate_profiles_skill_proof_score_idx
  on public.candidate_profiles(skill_proof_score desc);
create index if not exists candidate_profiles_company_search_visible_idx
  on public.candidate_profiles(company_search_visible) where company_search_visible = true;

-- Keep candidate_profiles.company_search_visible in sync with users.company_search_visible
create or replace function public.handle_user_company_search_visible_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.candidate_profiles
    set company_search_visible = new.company_search_visible
    where user_id = new.id;
  return new;
end $$;

drop trigger if exists trg_users_company_search_visible_sync on public.users;
create trigger trg_users_company_search_visible_sync
  after update of company_search_visible on public.users
  for each row execute function public.handle_user_company_search_visible_sync();

-- companies
alter table public.companies
  add column if not exists monthly_search_credit_balance int not null default 0,
  add column if not exists monthly_search_credit_reset_at timestamptz,
  add column if not exists owner_user_id uuid references public.users(id) on delete set null,
  add column if not exists plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'enterprise')),
  add column if not exists open_positions jsonb not null default '[]'::jsonb,
  add column if not exists search_filter jsonb not null default '{}'::jsonb;
create unique index if not exists companies_owner_user_idx
  on public.companies(owner_user_id) where owner_user_id is not null;

-- institution_members
alter table public.institution_members
  add column if not exists opted_in boolean not null default true;

-- recruiter_searches
alter table public.recruiter_searches
  add column if not exists last_run_at timestamptz,
  add column if not exists last_results_count int,
  add column if not exists recruiter_user_id uuid references public.users(id) on delete cascade,
  add column if not exists filters jsonb;
create index if not exists recruiter_searches_recruiter_user_idx
  on public.recruiter_searches(recruiter_user_id, created_at desc);

-- T033 (folded) — create a default nudge_preferences row when a users row is inserted.
-- Best-effort IANA timezone: hard-coded to Asia/Kolkata for v1 (the student can change it in settings).
create or replace function public.handle_new_user_create_nudge_prefs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.nudge_preferences (user_id, timezone)
  values (new.id, 'Asia/Kolkata')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_users_create_nudge_prefs on public.users;
create trigger trg_users_create_nudge_prefs
  after insert on public.users
  for each row execute function public.handle_new_user_create_nudge_prefs();
