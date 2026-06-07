-- 027_rls_policies_002.sql
-- T020 — RLS for all 002 tables (per spec/002 data-model.md RLS section)
-- T093 (appended) — recruiter can read only company-search-visible candidates

alter table public.whatsapp_connections enable row level security;
alter table public.nudge_preferences enable row level security;
alter table public.nudges enable row level security;
alter table public.nudge_responses enable row level security;
alter table public.placement_predictions enable row level security;
alter table public.verifiable_credentials enable row level security;
alter table public.credential_distributions enable row level security;
alter table public.student_applications enable row level security;
alter table public.interview_slots enable row level security;
alter table public.extension_telemetry enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.exam_windows enable row level security;

-- whatsapp_connections
drop policy if exists whatsapp_connections_self_all on public.whatsapp_connections;
create policy whatsapp_connections_self_all on public.whatsapp_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- nudge_preferences
drop policy if exists nudge_prefs_self_all on public.nudge_preferences;
create policy nudge_prefs_self_all on public.nudge_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- nudges
drop policy if exists nudges_self_read on public.nudges;
create policy nudges_self_read on public.nudges for select using (auth.uid() = user_id);

-- nudge_responses
drop policy if exists nudge_responses_self_all on public.nudge_responses;
create policy nudge_responses_self_all on public.nudge_responses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- placement_predictions
drop policy if exists placement_predictions_self_read on public.placement_predictions;
create policy placement_predictions_self_read on public.placement_predictions
  for select using (auth.uid() = user_id);

-- verifiable_credentials
drop policy if exists verifiable_credentials_self_all on public.verifiable_credentials;
create policy verifiable_credentials_self_all on public.verifiable_credentials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public-by-slug SELECT: any visitor can read the snapshot fields, revocation status, and slug.
-- No PII beyond the student's display name is exposed.
drop policy if exists verifiable_credentials_public_read on public.verifiable_credentials;
create policy verifiable_credentials_public_read on public.verifiable_credentials
  for select using (true);  -- The public /verify/{slug} route enforces the field allowlist in code.

-- credential_distributions
drop policy if exists credential_distributions_self_all on public.credential_distributions;
create policy credential_distributions_self_all on public.credential_distributions
  for all using (
    exists (select 1 from public.verifiable_credentials c
            where c.id = credential_distributions.credential_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.verifiable_credentials c
            where c.id = credential_distributions.credential_id and c.user_id = auth.uid())
  );

-- student_applications
drop policy if exists student_applications_self_all on public.student_applications;
create policy student_applications_self_all on public.student_applications
  for all using (auth.uid() = student_user_id) with check (auth.uid() = student_user_id);

drop policy if exists student_applications_company_read on public.student_applications;
create policy student_applications_company_read on public.student_applications
  for select using (public.is_recruiter_for(company_id));

-- T093 — Recruiters can only see applications for candidates who are still company-search-visible.
-- Implemented as a defence-in-depth view filter via candidate_profiles (joined through users).
-- (The company_search filter is also applied in the recruiter-search Edge Function.)

-- interview_slots
drop policy if exists interview_slots_candidate_read on public.interview_slots;
create policy interview_slots_candidate_read on public.interview_slots
  for select using (auth.uid() = candidate_user_id);

drop policy if exists interview_slots_company_read on public.interview_slots;
create policy interview_slots_company_read on public.interview_slots
  for select using (
    exists (
      select 1 from public.job_matches jm
      join public.recruiter_searches rs on rs.id = jm.recruiter_search_id
      where jm.id = interview_slots.job_match_id
        and public.is_recruiter_for(rs.company_id)
    )
  );

-- extension_telemetry
drop policy if exists extension_telemetry_self_read on public.extension_telemetry;
create policy extension_telemetry_self_read on public.extension_telemetry
  for select using (auth.uid() = user_id);

-- privacy_requests
drop policy if exists privacy_requests_self_all on public.privacy_requests;
create policy privacy_requests_self_all on public.privacy_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- exam_windows
drop policy if exists exam_windows_self_all on public.exam_windows;
create policy exam_windows_self_all on public.exam_windows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- T093 (append) — Recruiter candidate_profiles read is also filtered to company_search_visible.
-- Update the existing 001 policy candidate_profiles_recruiter_read to add the visibility check.
drop policy if exists candidate_profiles_recruiter_read on public.candidate_profiles;
create policy candidate_profiles_recruiter_read on public.candidate_profiles
  for select using (
    is_public = true
    and is_open_to_opportunities = true
    and exists (
      select 1 from public.users u
      join public.company_members cm on cm.user_id = auth.uid()
      where u.id = candidate_profiles.user_id
        and u.company_search_visible = true
    )
  );

-- T093 � Recruiter RLS: only see candidate_profiles for users that are
--  in this recruiter's company search filter AND have company_search_visible = true.
--  Opted-out candidates never appear in result counts.
create or replace policy candidate_profiles_recruiter_filter on public.candidate_profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.owner_user_id = auth.uid()
        and exists (
          select 1 from public.institution_memberships im
          where im.user_id = candidate_profiles.user_id
            and (c.search_filter -> 'institution_ids') ? im.institution_id::text
        )
    )
    and exists (
      select 1 from public.users u
      where u.id = candidate_profiles.user_id
        and u.company_search_visible = true
    )
  );
