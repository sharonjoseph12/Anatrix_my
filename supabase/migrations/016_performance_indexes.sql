-- supabase/migrations/016_performance_indexes.sql
-- T096 — Hot-path index audits for the queries the app actually runs.

-- candidate_profiles: ranked search
create index if not exists idx_candidate_profiles_score_desc
  on public.candidate_profiles (overall_skill_proof_score desc)
  where is_public = true;

create index if not exists idx_candidate_profiles_placement
  on public.candidate_profiles (placement_ready, overall_skill_proof_score desc)
  where is_public = true;

-- user_skills: per-user breakdown + skill filter
create index if not exists idx_user_skills_user_score
  on public.user_skills (user_id, skill_proof_score desc);

-- sessions: history pagination
create index if not exists idx_sessions_user_started
  on public.sessions (user_id, started_at desc);

-- job_matches: pipeline kanban + analytics
create index if not exists idx_job_matches_company_status
  on public.job_matches (company_id, status, created_at desc);

-- notifications: realtime + unread
-- (already created in 015_notifications.sql)

-- recruiter_searches: analytics
create index if not exists idx_recruiter_searches_company_created
  on public.recruiter_searches (company_id, created_at desc);
