-- 023_applications.sql
-- T016 — student_applications, interview_slots

create type application_status as enum (
  'submitted', 'viewed_by_company', 'interview_proposed', 'interview_accepted', 'rejected', 'withdrawn'
);
create type interview_slot_status as enum (
  'proposed', 'accepted', 'declined', 'rescheduled', 'completed'
);

create table if not exists public.student_applications (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  credential_snapshot_id uuid not null references public.verifiable_credentials(id),
  status application_status not null default 'submitted',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, company_id)
);
create index if not exists student_applications_company_status_idx
  on public.student_applications(company_id, status, applied_at desc);
create index if not exists student_applications_student_idx
  on public.student_applications(student_user_id, applied_at desc);

create table if not exists public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  job_match_id uuid not null references public.job_matches(id) on delete cascade,
  candidate_user_id uuid not null references public.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  candidate_peak_window_match boolean,
  candidate_calendar_free boolean,
  interviewer_calendar_free boolean,
  status interview_slot_status not null default 'proposed',
  created_at timestamptz not null default now()
);
create index if not exists interview_slots_job_match_idx on public.interview_slots(job_match_id);
create index if not exists interview_slots_candidate_idx on public.interview_slots(candidate_user_id, starts_at);
