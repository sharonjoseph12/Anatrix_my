-- 036_hackathon_mockinterview.sql
-- 11/10 — Hackathons + Mock Interviews (active validation surfaces)
--
-- Strictly additive. No edits to 001-035. Every DDL uses `if not exists` /
-- guarded `do` blocks / `drop policy if exists` + `create policy`, so the
-- file is safe to re-apply.
--
-- Tables:
--   public.hackathons
--   public.hackathon_submissions
--   public.hackathon_credentials
--   public.mock_interviews
--   public.mock_interview_turns
--
-- FKs go to:
--   public.users(id)                  (existing 001)
--   public.hackathons(id)             (this file)
--   public.mock_interviews(id)        (this file)
--   public.verifiable_credentials(id) (existing 022; 032 added W3C fields)

-- =============================================================================
-- 1. public.hackathons
-- Recruiter-authored time-boxed coding contests. Window is constrained to
-- 24h..168h and `ends_at > starts_at`.
-- =============================================================================

create table if not exists public.hackathons (
  id              uuid primary key default gen_random_uuid(),
  recruiter_id    uuid not null references public.users(id) on delete cascade,
  title           text not null,
  problem         text not null,
  test_cases_url  text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  prize_structure jsonb not null,
  status          text not null default 'draft'
                    check (status in ('draft', 'live', 'completed', 'cancelled')),
  created_at      timestamptz not null default now()
);

comment on table  public.hackathons is
  'Recruiter-authored time-boxed coding contests used as active skill validation.';
comment on column public.hackathons.test_cases_url is
  'Signed Supabase Storage URL to the private test-cases object.';
comment on column public.hackathons.prize_structure is
  'JSON describing per-rank rewards, e.g. {"top_5_pct":"interview_fast_track","top_1":"cash_5000_inr"}.';

-- Window CHECK: `ends_at > starts_at` AND duration is 24h..168h. Guarded so
-- re-running the migration is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'hackathons_window_chk'
  ) then
    alter table public.hackathons
      add constraint hackathons_window_chk
      check (
        ends_at > starts_at
        and (ends_at - starts_at) between interval '24 hours' and interval '168 hours'
      );
  end if;
end $$;

alter table public.hackathons enable row level security;

-- Any authenticated user can SELECT a hackathon (students browse live ones,
-- recruiters see the catalogue). Visibility is then refined in the application
-- layer for `draft` rows owned by other recruiters.
drop policy if exists hackathons_select_authenticated on public.hackathons;
create policy hackathons_select_authenticated on public.hackathons
  for select using (auth.role() = 'authenticated');

-- Recruiters can create hackathons they own.
drop policy if exists hackathons_insert_owner on public.hackathons;
create policy hackathons_insert_owner on public.hackathons
  for insert with check (auth.uid() = recruiter_id);

-- Recruiters can update their own hackathons.
drop policy if exists hackathons_update_owner on public.hackathons;
create policy hackathons_update_owner on public.hackathons
  for update using (auth.uid() = recruiter_id)
            with check (auth.uid() = recruiter_id);

-- Recruiters can delete (cancel) their own hackathons.
drop policy if exists hackathons_delete_owner on public.hackathons;
create policy hackathons_delete_owner on public.hackathons
  for delete using (auth.uid() = recruiter_id);

-- =============================================================================
-- 2. public.hackathon_submissions
-- One row per student submission. Populated by the `hackathon-grader` edge
-- function which writes `test_results` and `score` asynchronously.
-- =============================================================================

create table if not exists public.hackathon_submissions (
  id            uuid primary key default gen_random_uuid(),
  hackathon_id  uuid not null references public.hackathons(id) on delete cascade,
  student_id    uuid not null references public.users(id) on delete cascade,
  code_url      text not null,
  language      text not null
                  check (language in ('python', 'javascript', 'typescript', 'go', 'rust')),
  test_results  jsonb,
  score         int  check (score between 0 and 100),
  submitted_at  timestamptz not null default now(),
  graded_at     timestamptz
);

comment on table  public.hackathon_submissions is
  'Student submissions to hackathons; test_results/score are written by the grader edge function.';
comment on column public.hackathon_submissions.code_url is
  'Signed Supabase Storage URL to the submitted source archive.';
comment on column public.hackathon_submissions.test_results is
  'Structured grader output: {passed: int, failed: int, total: int, log: text}.';

create index if not exists hackathon_submissions_hackathon_score_idx
  on public.hackathon_submissions (hackathon_id, score desc nulls last);

alter table public.hackathon_submissions enable row level security;

-- Students see their own submissions.
drop policy if exists hackathon_submissions_select_self on public.hackathon_submissions;
create policy hackathon_submissions_select_self on public.hackathon_submissions
  for select using (auth.uid() = student_id);

-- Recruiters see all submissions against hackathons they own.
drop policy if exists hackathon_submissions_select_recruiter on public.hackathon_submissions;
create policy hackathon_submissions_select_recruiter on public.hackathon_submissions
  for select using (
    exists (
      select 1 from public.hackathons h
       where h.id = hackathon_submissions.hackathon_id
         and h.recruiter_id = auth.uid()
    )
  );

-- Students can submit to a hackathon on their own behalf.
drop policy if exists hackathon_submissions_insert_self on public.hackathon_submissions;
create policy hackathon_submissions_insert_self on public.hackathon_submissions
  for insert with check (auth.uid() = student_id);

-- =============================================================================
-- 3. public.hackathon_credentials
-- Participation/placement credentials emitted at hackathon close. `vc_id`
-- links the row to its W3C Verifiable Credential envelope (022 + 032).
-- =============================================================================

create table if not exists public.hackathon_credentials (
  id            uuid primary key default gen_random_uuid(),
  hackathon_id  uuid not null references public.hackathons(id) on delete cascade,
  student_id    uuid not null references public.users(id) on delete cascade,
  rank          int,
  kind          text not null
                  check (kind in ('participation', 'top_10_pct', 'top_1_pct', 'winner')),
  vc_id         uuid references public.verifiable_credentials(id) on delete set null,
  issued_at     timestamptz not null default now()
);

comment on table  public.hackathon_credentials is
  'Credentials awarded at hackathon close. Optionally anchored to a W3C VC via vc_id.';
comment on column public.hackathon_credentials.kind is
  'Bucket of the award: participation, top_10_pct, top_1_pct, or outright winner.';
comment on column public.hackathon_credentials.vc_id is
  'Optional FK to public.verifiable_credentials.id (022/032). Null until issuance.';

alter table public.hackathon_credentials enable row level security;

-- Students can read credentials they received.
drop policy if exists hackathon_credentials_select_self on public.hackathon_credentials;
create policy hackathon_credentials_select_self on public.hackathon_credentials
  for select using (auth.uid() = student_id);

-- No INSERT / UPDATE / DELETE policies: with RLS enabled and no permissive
-- policy, anon and authenticated are denied. Writes happen via service_role
-- (e.g. from the hackathon-close edge function) which bypasses RLS.

-- =============================================================================
-- 4. public.mock_interviews
-- AI-conducted practice interviews. `score_contribution` is bounded 0..100
-- and is the per-interview slice of the weekly cap applied to overall score.
-- =============================================================================

create table if not exists public.mock_interviews (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.users(id) on delete cascade,
  topic               text not null,
  status              text not null default 'in_progress'
                        check (status in ('in_progress', 'completed', 'abandoned')),
  rubric              jsonb,
  score_contribution  int  check (score_contribution between 0 and 100),
  total_tokens        int  not null default 0,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz
);

comment on table  public.mock_interviews is
  'AI-conducted mock interviews. score_contribution is bounded by the weekly cap in the scoring service.';
comment on column public.mock_interviews.rubric is
  'Per-dimension grading, e.g. {"clarity":7,"depth":6,"correctness":8,"summary":"..."}.';

create index if not exists mock_interviews_student_started_idx
  on public.mock_interviews (student_id, started_at desc);

alter table public.mock_interviews enable row level security;

-- Students can read their own mock interviews.
drop policy if exists mock_interviews_select_self on public.mock_interviews;
create policy mock_interviews_select_self on public.mock_interviews
  for select using (auth.uid() = student_id);

-- Students can start (insert) their own mock interviews.
drop policy if exists mock_interviews_insert_self on public.mock_interviews;
create policy mock_interviews_insert_self on public.mock_interviews
  for insert with check (auth.uid() = student_id);

-- No UPDATE / DELETE policies for authenticated. status transitions and
-- rubric writes are performed by the interviewer edge function under
-- service_role, which bypasses RLS.

-- =============================================================================
-- 5. public.mock_interview_turns
-- Append-only transcript of a mock interview. `interview_id` cascades so a
-- deleted interview removes its turns in the same transaction.
-- =============================================================================

create table if not exists public.mock_interview_turns (
  id           uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.mock_interviews(id) on delete cascade,
  turn_index   int  not null,
  role         text not null
                 check (role in ('student', 'interviewer')),
  content      text not null,
  tokens_used  int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (interview_id, turn_index)
);

comment on table  public.mock_interview_turns is
  'Append-only transcript rows for a mock_interview. UNIQUE(interview_id, turn_index) keeps order stable.';

-- The UNIQUE constraint above creates a btree index that doubles as the
-- primary lookup path for "fetch turn N of interview M".

alter table public.mock_interview_turns enable row level security;

-- Students can read turns belonging to their own interviews.
drop policy if exists mock_interview_turns_select_self on public.mock_interview_turns;
create policy mock_interview_turns_select_self on public.mock_interview_turns
  for select using (
    exists (
      select 1 from public.mock_interviews mi
       where mi.id = mock_interview_turns.interview_id
         and mi.student_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policies: turns are appended by the interviewer
-- edge function under service_role (which bypasses RLS). This guarantees
-- transcript integrity — students cannot forge or rewrite their history.
