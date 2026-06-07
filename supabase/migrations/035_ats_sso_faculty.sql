-- 035_ats_sso_faculty.sql
-- T-ATS-SSO-FAC: Greenhouse / Lever ATS push, WorkOS SSO for institutions,
-- and the faculty verification + grading surface.
--
-- Strictly additive. No edits to migrations 001-034. Every DDL uses
-- `if not exists` / `or replace` / guarded `do` blocks so the file is safe
-- to re-apply.
--
-- New tables (in dependency order):
--   public.ats_connections        -- per-recruiter Greenhouse/Lever credential
--   public.ats_saved_searches     -- saved queries the recruiter pushes on a schedule
--   public.ats_sync_log           -- append-only push audit trail
--   public.sso_connections        -- WorkOS link for one institution (one per inst)
--   public.faculty_verifications  -- "is this user actually faculty at X?" lookup
--   public.assignments            -- course assignment defined by faculty/admin
--   public.faculty_grades         -- grade issued by faculty to a student
--
-- Conventions followed (see 032_w3c_vc.sql, 018_external_channels.sql):
--   * `create table if not exists`
--   * CHECK constraints wrapped in `do $$ ... end $$` so re-runs are no-ops
--   * RLS enabled; per-role policies via `drop policy if exists` + `create policy`
--   * `references public.users(id) on delete cascade` for FKs
--   * `comment on table` / `comment on column` for non-obvious columns
--
-- Security model summary:
--   * ATS tables: scoped to the owning recruiter; writes flow through the
--     `ats-push` edge function with the service role.
--   * sso_connections: institution admins / placement officers can see their
--     institution's row; creation/deletion is service-role-only.
--   * faculty_verifications: a user can read their own row; institution admins
--     can read rows that belong to their institution; writes are service-role.
--   * assignments / faculty_grades: visible to the relevant institution's
--     members; faculty_grades also gives the student + the issuing faculty
--     a personal view of the rows they care about.

-- =============================================================================
-- 1. public.ats_connections
--    One row per (recruiter, ATS provider). The api_key_encrypted column holds
--    ciphertext only — encryption / decryption happens in the application layer
--    (KMS envelope encryption or pgsodium). The schema does not enforce that.
-- =============================================================================

create table if not exists public.ats_connections (
  id                 uuid primary key default gen_random_uuid(),
  recruiter_id       uuid not null references public.users(id) on delete cascade,
  provider           text not null,
  api_key_encrypted  text not null,
  pool_id            text,
  status             text not null default 'active',
  last_sync_at       timestamptz,
  failure_count      int  not null default 0,
  created_at         timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ats_connections_provider_chk'
  ) then
    alter table public.ats_connections
      add constraint ats_connections_provider_chk
      check (provider in ('greenhouse', 'lever'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ats_connections_status_chk'
  ) then
    alter table public.ats_connections
      add constraint ats_connections_status_chk
      check (status in ('active', 'paused', 'revoked'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ats_connections_failure_count_chk'
  ) then
    alter table public.ats_connections
      add constraint ats_connections_failure_count_chk
      check (failure_count >= 0);
  end if;
end $$;

create index if not exists idx_ats_connections_recruiter
  on public.ats_connections (recruiter_id);

create index if not exists idx_ats_connections_provider_status
  on public.ats_connections (provider, status);

alter table public.ats_connections enable row level security;

drop policy if exists ats_connections_select_self on public.ats_connections;
create policy ats_connections_select_self on public.ats_connections
  for select using (auth.uid() = recruiter_id);

-- INSERT / UPDATE / DELETE: no policy. Writes are service-role-only
-- (the ats-push edge function provisions / rotates credentials).

comment on table  public.ats_connections is 'Recruiter ATS credentials (Greenhouse / Lever). Writes are done via the ats-push edge function with the service role.';
comment on column public.ats_connections.api_key_encrypted is 'Ciphertext only. Envelope encryption happens in the app / KMS layer; the schema does not enforce plaintext absence.';
comment on column public.ats_connections.pool_id is 'Greenhouse pool ID or Lever stage ID — provider-specific.';
comment on column public.ats_connections.failure_count is 'Consecutive failure count. Reset on next successful sync; revocation logic lives in the edge function.';

-- =============================================================================
-- 2. public.ats_saved_searches
--    Persisted query the recruiter wants pushed to their ATS on a schedule.
-- =============================================================================

create table if not exists public.ats_saved_searches (
  id                 uuid primary key default gen_random_uuid(),
  connection_id      uuid not null references public.ats_connections(id) on delete cascade,
  name               text not null,
  query_json         jsonb not null,
  min_score          int  not null default 75,
  active             boolean not null default true,
  last_evaluated_at  timestamptz,
  created_at         timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ats_saved_searches_min_score_chk'
  ) then
    alter table public.ats_saved_searches
      add constraint ats_saved_searches_min_score_chk
      check (min_score between 0 and 100);
  end if;
end $$;

create index if not exists idx_ats_saved_searches_connection
  on public.ats_saved_searches (connection_id);

create index if not exists idx_ats_saved_searches_active
  on public.ats_saved_searches (active)
  where active = true;

alter table public.ats_saved_searches enable row level security;

drop policy if exists ats_saved_searches_select_via_connection on public.ats_saved_searches;
create policy ats_saved_searches_select_via_connection on public.ats_saved_searches
  for select using (
    exists (
      select 1
        from public.ats_connections c
       where c.id = ats_saved_searches.connection_id
         and c.recruiter_id = auth.uid()
    )
  );

-- INSERT / UPDATE / DELETE: no policy. Writes are service-role-only.

comment on table  public.ats_saved_searches is 'Saved search queries the recruiter wants pushed to their ATS on a cron schedule.';
comment on column public.ats_saved_searches.query_json is 'Provider-agnostic query (skills, locations, batch_years, etc.) translated to Greenhouse/Lever syntax in the edge function.';

-- =============================================================================
-- 3. public.ats_sync_log
--    Append-only audit trail. Inserts are service-role-only (no policy = denied
--    for anon / authenticated; service role bypasses RLS).
-- =============================================================================

create table if not exists public.ats_sync_log (
  id               bigserial primary key,
  connection_id    uuid not null references public.ats_connections(id) on delete cascade,
  saved_search_id  uuid not null references public.ats_saved_searches(id) on delete cascade,
  student_id       uuid not null references public.users(id) on delete cascade,
  status           text not null,
  attempt          int  not null,
  error            text,
  pushed_at        timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ats_sync_log_status_chk'
  ) then
    alter table public.ats_sync_log
      add constraint ats_sync_log_status_chk
      check (status in ('success', 'retry', 'failed_permanent'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ats_sync_log_attempt_chk'
  ) then
    alter table public.ats_sync_log
      add constraint ats_sync_log_attempt_chk
      check (attempt >= 1);
  end if;
end $$;

create index if not exists idx_ats_sync_log_connection_pushed_at
  on public.ats_sync_log (connection_id, pushed_at desc);

create index if not exists idx_ats_sync_log_student
  on public.ats_sync_log (student_id);

alter table public.ats_sync_log enable row level security;

-- Recruiter can read their own push history (via the owning connection).
drop policy if exists ats_sync_log_select_via_connection on public.ats_sync_log;
create policy ats_sync_log_select_via_connection on public.ats_sync_log
  for select using (
    exists (
      select 1
        from public.ats_connections c
       where c.id = ats_sync_log.connection_id
         and c.recruiter_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policy on purpose: writes are service-role-only
-- (the ats-push edge function). RLS denies anon and authenticated by default.

comment on table  public.ats_sync_log is 'Append-only push audit trail. Inserts are performed by the ats-push edge function with the service role.';
comment on column public.ats_sync_log.attempt is '1-based attempt number; retry chain continues from the previous attempt row.';

-- =============================================================================
-- 4. public.sso_connections
--    WorkOS link for one institution. UNIQUE on institution_id guarantees a
--    1:1 mapping; UNIQUE on workos_connection_id guarantees no two institutions
--    share a WorkOS connection.
-- =============================================================================

create table if not exists public.sso_connections (
  id                   uuid primary key default gen_random_uuid(),
  institution_id       uuid not null unique references public.institutions(id) on delete cascade,
  workos_connection_id text not null unique,
  idp_type             text,
  status               text not null default 'pending',
  created_at           timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sso_connections_status_chk'
  ) then
    alter table public.sso_connections
      add constraint sso_connections_status_chk
      check (status in ('pending', 'active', 'disabled'));
  end if;
end $$;

alter table public.sso_connections enable row level security;

drop policy if exists sso_connections_select_admins on public.sso_connections;
create policy sso_connections_select_admins on public.sso_connections
  for select using (
    exists (
      select 1
        from public.institution_members m
       where m.institution_id = sso_connections.institution_id
         and m.user_id = auth.uid()
         and m.role in ('admin', 'placement_officer')
    )
  );

-- Writes are service-role-only (no INSERT / UPDATE / DELETE policy).

comment on table  public.sso_connections is 'WorkOS SSO link for an institution. At most one row per institution.';
comment on column public.sso_connections.workos_connection_id is 'WorkOS connection ID (conn_...). Globally unique across institutions.';
comment on column public.sso_connections.idp_type is 'e.g. okta, azure, google, generic-saml. Free-form text; no enum lock-in.';

-- =============================================================================
-- 5. public.faculty_verifications
--    "Is user X actually faculty at institution Y?" — one row per user
--    (UNIQUE on user_id). verified_by records who flipped the bit.
-- =============================================================================

create table if not exists public.faculty_verifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  verified        boolean not null default false,
  verified_by     uuid references public.users(id) on delete set null,
  verified_at     timestamptz,
  revoked_at      timestamptz
);

create index if not exists idx_faculty_verifications_institution
  on public.faculty_verifications (institution_id);

create index if not exists idx_faculty_verifications_verified
  on public.faculty_verifications (verified)
  where verified = true;

alter table public.faculty_verifications enable row level security;

drop policy if exists faculty_verifications_select_self on public.faculty_verifications;
create policy faculty_verifications_select_self on public.faculty_verifications
  for select using (auth.uid() = user_id);

drop policy if exists faculty_verifications_select_institution_admins on public.faculty_verifications;
create policy faculty_verifications_select_institution_admins on public.faculty_verifications
  for select using (
    exists (
      select 1
        from public.institution_members m
       where m.institution_id = faculty_verifications.institution_id
         and m.user_id = auth.uid()
         and m.role in ('admin', 'placement_officer')
    )
  );

-- Writes (insert / update / revoke) are service-role-only.

comment on table  public.faculty_verifications is 'Per-user "is faculty at institution X" flag. Writes are service-role-only (admin tooling / WorkOS directory sync).';
comment on column public.faculty_verifications.verified_by is 'User who flipped verified from false to true. NULL for system-granted verifications.';
comment on column public.faculty_verifications.revoked_at is 'When set, the row is treated as revoked regardless of `verified`.';

-- =============================================================================
-- 6. public.assignments
--    Course assignment defined by a faculty member (or an admin) for an
--    institution. Grading lives in faculty_grades.
-- =============================================================================

create table if not exists public.assignments (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  title           text not null,
  description     text,
  course_code     text,
  max_grade       int  not null default 100,
  created_by      uuid not null references public.users(id) on delete restrict,
  created_at      timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assignments_max_grade_chk'
  ) then
    alter table public.assignments
      add constraint assignments_max_grade_chk
      check (max_grade between 1 and 1000);
  end if;
end $$;

create index if not exists idx_assignments_institution
  on public.assignments (institution_id);

create index if not exists idx_assignments_institution_course
  on public.assignments (institution_id, course_code);

alter table public.assignments enable row level security;

-- Any institution member can read assignments for their institution.
drop policy if exists assignments_select_institution_members on public.assignments;
create policy assignments_select_institution_members on public.assignments
  for select using (
    exists (
      select 1
        from public.institution_members m
       where m.institution_id = assignments.institution_id
         and m.user_id = auth.uid()
    )
  );

-- Admins / placement officers can create / modify / delete assignments.
drop policy if exists assignments_write_institution_admins on public.assignments;
create policy assignments_write_institution_admins on public.assignments
  for all using (
    exists (
      select 1
        from public.institution_members m
       where m.institution_id = assignments.institution_id
         and m.user_id = auth.uid()
         and m.role in ('admin', 'placement_officer')
    )
  )
  with check (
    exists (
      select 1
        from public.institution_members m
       where m.institution_id = assignments.institution_id
         and m.user_id = auth.uid()
         and m.role in ('admin', 'placement_officer')
    )
  );

comment on table  public.assignments is 'Course assignment for an institution. Created by admins / placement officers; graded by faculty.';
comment on column public.assignments.max_grade is 'Inclusive upper bound. Default 100. Permits 0..1000 to support non-percentage rubrics.';

-- =============================================================================
-- 7. public.faculty_grades
--    Grade issued by faculty to a student for an assignment. UNIQUE on
--    (faculty_id, student_id, assignment_id) prevents duplicate grading —
--    amendments create a new row with a separate flow (not modelled here).
-- =============================================================================

create table if not exists public.faculty_grades (
  id             uuid primary key default gen_random_uuid(),
  faculty_id     uuid not null references public.users(id) on delete cascade,
  student_id     uuid not null references public.users(id) on delete cascade,
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  grade          int  not null,
  comment        text,
  graded_at      timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'faculty_grades_grade_chk'
  ) then
    alter table public.faculty_grades
      add constraint faculty_grades_grade_chk
      check (grade between 0 and 100);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'faculty_grades_faculty_student_assignment_uniq'
  ) then
    alter table public.faculty_grades
      add constraint faculty_grades_faculty_student_assignment_uniq
      unique (faculty_id, student_id, assignment_id);
  end if;
end $$;

create index if not exists idx_faculty_grades_student_graded_at
  on public.faculty_grades (student_id, graded_at desc);

create index if not exists idx_faculty_grades_assignment
  on public.faculty_grades (assignment_id);

alter table public.faculty_grades enable row level security;

-- Student sees their own grades.
drop policy if exists faculty_grades_select_student on public.faculty_grades;
create policy faculty_grades_select_student on public.faculty_grades
  for select using (auth.uid() = student_id);

-- Faculty sees the grades they personally issued.
drop policy if exists faculty_grades_select_faculty on public.faculty_grades;
create policy faculty_grades_select_faculty on public.faculty_grades
  for select using (auth.uid() = faculty_id);

-- Institution admins / placement officers see every grade in their institution
-- (joined via assignments.institution_id).
drop policy if exists faculty_grades_select_institution_admins on public.faculty_grades;
create policy faculty_grades_select_institution_admins on public.faculty_grades
  for select using (
    exists (
      select 1
        from public.assignments a
        join public.institution_members m on m.institution_id = a.institution_id
       where a.id = faculty_grades.assignment_id
         and m.user_id = auth.uid()
         and m.role in ('admin', 'placement_officer')
    )
  );

-- Writes are service-role-only (grading edge function). The faculty_id column
-- is set by the service role based on the authenticated session, never by the
-- client directly.

comment on table  public.faculty_grades is 'Grade issued by faculty to a student for an assignment. One row per (faculty, student, assignment) — amendments create new rows via a separate flow.';
comment on column public.faculty_grades.grade is '0..100. The assignment.max_grade cap is enforced at the application layer (this column is independent of any specific assignment''s max).';
