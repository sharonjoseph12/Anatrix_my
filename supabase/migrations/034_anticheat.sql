-- 034_anticheat.sql
-- T-AC1..AC4 + T-I18N — Anti-cheat detection + i18n missing-key queue.
--
-- Strictly additive. No edits to any 001-033 table other than the four
-- column additions listed in specs/004-eleven-of-ten/data-model.md.
-- Every DDL is idempotent (`if not exists`, `do $$ ... end $$` guards on
-- CHECK constraints, `drop policy if exists` then `create policy`), so the
-- file is safe to re-apply.
--
-- Layer model:
--   public.anticheat_signals   — one row per detected signal per entity
--   public.anticheat_appeals   — student appeals against a signal
--   public.anticheat_audit     — immutable log of every quarantine/decision
--   public.i18n_missing_keys   — translator queue for missing locale keys
--
-- Column extensions:
--   public.users.locale                          text  not null default 'en'
--   public.github_repos.anticheat_score          numeric(3,2) nullable
--   public.github_repos.quarantined_at           timestamptz   nullable
--   public.user_dsa_profiles.anticheat_score     numeric(3,2) nullable
--   public.user_dsa_profiles.quarantined_at      timestamptz   nullable
--
-- All RLS is enabled. RLS policy plan:
--   anticheat_signals   : students see own; faculty/mentors of student's
--                         institution see; service role full.
--   anticheat_appeals   : students see own + insert own; faculty/mentors at
--                         same institution see; mentors update; service role
--                         full.
--   anticheat_audit     : read-only for authenticated; insert via service
--                         role only (no write policies at all).
--   i18n_missing_keys   : NO policies; service-role-only reads.

-- =============================================================================
-- 1. Column extensions on existing tables
-- =============================================================================

alter table public.users
  add column if not exists locale text not null default 'en';

-- users.locale must be one of the 5 supported locales. Guarded by a do
-- block so re-running the migration is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'users_locale_chk'
  ) then
    alter table public.users
      add constraint users_locale_chk
      check (locale in ('en', 'hi', 'ta', 'te', 'mr'));
  end if;
end $$;

comment on column public.users.locale is
  'BCP-47-ish 2-letter locale for the user; drives i18n rendering. One of en/hi/ta/te/mr.';

alter table public.github_repos
  add column if not exists anticheat_score  numeric(3,2);

alter table public.github_repos
  add column if not exists quarantined_at   timestamptz;

-- github_repos.anticheat_score must be in [0, 1].
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'github_repos_anticheat_score_chk'
  ) then
    alter table public.github_repos
      add constraint github_repos_anticheat_score_chk
      check (anticheat_score is null
             or (anticheat_score >= 0 and anticheat_score <= 1));
  end if;
end $$;

comment on column public.github_repos.anticheat_score is
  'Aggregate anticheat suspicion score in [0, 1]. NULL = never scored.';
comment on column public.github_repos.quarantined_at is
  'Timestamp at which the repo was quarantined due to anticheat signals. NULL = active.';

alter table public.user_dsa_profiles
  add column if not exists anticheat_score  numeric(3,2);

alter table public.user_dsa_profiles
  add column if not exists quarantined_at   timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'user_dsa_profiles_anticheat_score_chk'
  ) then
    alter table public.user_dsa_profiles
      add constraint user_dsa_profiles_anticheat_score_chk
      check (anticheat_score is null
             or (anticheat_score >= 0 and anticheat_score <= 1));
  end if;
end $$;

comment on column public.user_dsa_profiles.anticheat_score is
  'Aggregate anticheat suspicion score in [0, 1] for DSA submissions. NULL = never scored.';
comment on column public.user_dsa_profiles.quarantined_at is
  'Timestamp at which the profile was quarantined due to anticheat signals. NULL = active.';

-- =============================================================================
-- 2. public.anticheat_signals
-- =============================================================================
-- One row per detected signal per entity (repo or DSA record). The detector
-- re-runs set `superseded_by` on stale rows; queries for "active" signals
-- use the partial index below.

create table if not exists public.anticheat_signals (
  id               uuid primary key default gen_random_uuid(),
  entity_type      text not null,
  entity_id        uuid not null,
  student_id       uuid not null references public.users(id) on delete cascade,
  signal           text not null,
  confidence       numeric(3,2) not null,
  evidence_url     text,
  evidence_payload jsonb,
  detected_at      timestamptz not null default now(),
  superseded_by    uuid references public.anticheat_signals(id)
);

comment on table public.anticheat_signals is
  'One row per anticheat signal detected against a student-owned entity (repo / DSA record).';
comment on column public.anticheat_signals.entity_type is
  'Either github_repo or dsa_record; entity_id is FK-enforced at the application layer because the target table depends on entity_type.';
comment on column public.anticheat_signals.signal is
  'Discriminator for the detector rule. One of fork_no_commits, commit_cluster_time, ai_generated_suspect, copied_content_overlap, impossible_velocity, rating_delta_anomaly.';
comment on column public.anticheat_signals.confidence is
  'Detector confidence in [0, 1].';
comment on column public.anticheat_signals.superseded_by is
  'When the detector re-runs and produces a newer signal for the same (entity_type, entity_id, signal), the older row is linked here.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'anticheat_signals_entity_type_chk'
  ) then
    alter table public.anticheat_signals
      add constraint anticheat_signals_entity_type_chk
      check (entity_type in ('github_repo', 'dsa_record'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'anticheat_signals_signal_chk'
  ) then
    alter table public.anticheat_signals
      add constraint anticheat_signals_signal_chk
      check (signal in (
        'fork_no_commits',
        'commit_cluster_time',
        'ai_generated_suspect',
        'copied_content_overlap',
        'impossible_velocity',
        'rating_delta_anomaly'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'anticheat_signals_confidence_chk'
  ) then
    alter table public.anticheat_signals
      add constraint anticheat_signals_confidence_chk
      check (confidence >= 0 and confidence <= 1);
  end if;
end $$;

create index if not exists anticheat_signals_student_detected_idx
  on public.anticheat_signals (student_id, detected_at desc);

create index if not exists anticheat_signals_entity_active_idx
  on public.anticheat_signals (entity_type, entity_id)
  where superseded_by is null;

alter table public.anticheat_signals enable row level security;

-- Student can read their own signals.
drop policy if exists anticheat_signals_select_self on public.anticheat_signals;
create policy anticheat_signals_select_self on public.anticheat_signals
  for select using (auth.uid() = student_id);

-- Faculty / admin / placement officer at the same institution as the
-- student can read those signals (mentor visibility per spec).
drop policy if exists anticheat_signals_select_institution_mentors
  on public.anticheat_signals;
create policy anticheat_signals_select_institution_mentors
  on public.anticheat_signals
  for select using (
    exists (
      select 1
        from public.institution_members me
        join public.institution_members st
          on st.institution_id = me.institution_id
       where me.user_id = auth.uid()
         and st.user_id = anticheat_signals.student_id
         and me.role in ('faculty', 'admin', 'placement_officer')
    )
  );

-- No INSERT / UPDATE / DELETE policies for authenticated. Service role
-- bypasses RLS, so all writes flow through the edge function with
-- service-role credentials.

-- =============================================================================
-- 3. public.anticheat_appeals
-- =============================================================================
-- Student-filed appeal against a signal. Mentor (faculty/admin at the same
-- institution) decides.

create table if not exists public.anticheat_appeals (
  id           uuid primary key default gen_random_uuid(),
  signal_id    uuid not null references public.anticheat_signals(id) on delete cascade,
  student_id   uuid not null references public.users(id) on delete cascade,
  explanation  text not null,
  evidence_url text,
  status       text not null default 'pending',
  mentor_id    uuid references public.users(id),
  mentor_note  text,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.anticheat_appeals is
  'Student appeal against an anticheat signal; resolved by a faculty/mentor at the same institution.';
comment on column public.anticheat_appeals.status is
  'Appeal lifecycle. One of pending, approved, rejected, withdrawn.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'anticheat_appeals_status_chk'
  ) then
    alter table public.anticheat_appeals
      add constraint anticheat_appeals_status_chk
      check (status in ('pending', 'approved', 'rejected', 'withdrawn'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'anticheat_appeals_explanation_len_chk'
  ) then
    alter table public.anticheat_appeals
      add constraint anticheat_appeals_explanation_len_chk
      check (char_length(explanation) >= 30);
  end if;
end $$;

create index if not exists anticheat_appeals_student_status_idx
  on public.anticheat_appeals (student_id, status);

create index if not exists anticheat_appeals_mentor_status_idx
  on public.anticheat_appeals (mentor_id, status);

alter table public.anticheat_appeals enable row level security;

-- Student reads own appeals.
drop policy if exists anticheat_appeals_select_self on public.anticheat_appeals;
create policy anticheat_appeals_select_self on public.anticheat_appeals
  for select using (auth.uid() = student_id);

-- Student can file an appeal on their own behalf.
drop policy if exists anticheat_appeals_insert_self on public.anticheat_appeals;
create policy anticheat_appeals_insert_self on public.anticheat_appeals
  for insert with check (auth.uid() = student_id);

-- Student can withdraw their own pending appeal.
drop policy if exists anticheat_appeals_update_withdraw_self
  on public.anticheat_appeals;
create policy anticheat_appeals_update_withdraw_self
  on public.anticheat_appeals
  for update using (
    auth.uid() = student_id and status = 'pending'
  )
  with check (
    auth.uid() = student_id and status in ('pending', 'withdrawn')
  );

-- Faculty / admin / placement officer at the same institution as the
-- student can read appeals for students they mentor.
drop policy if exists anticheat_appeals_select_institution_mentors
  on public.anticheat_appeals;
create policy anticheat_appeals_select_institution_mentors
  on public.anticheat_appeals
  for select using (
    exists (
      select 1
        from public.institution_members me
        join public.institution_members st
          on st.institution_id = me.institution_id
       where me.user_id = auth.uid()
         and st.user_id = anticheat_appeals.student_id
         and me.role in ('faculty', 'admin', 'placement_officer')
    )
  );

-- Same institution mentors can decide (set status, mentor_note, decided_at).
drop policy if exists anticheat_appeals_update_institution_mentors
  on public.anticheat_appeals;
create policy anticheat_appeals_update_institution_mentors
  on public.anticheat_appeals
  for update using (
    exists (
      select 1
        from public.institution_members me
        join public.institution_members st
          on st.institution_id = me.institution_id
       where me.user_id = auth.uid()
         and st.user_id = anticheat_appeals.student_id
         and me.role in ('faculty', 'admin', 'placement_officer')
    )
  )
  with check (
    exists (
      select 1
        from public.institution_members me
        join public.institution_members st
          on st.institution_id = me.institution_id
       where me.user_id = auth.uid()
         and st.user_id = anticheat_appeals.student_id
         and me.role in ('faculty', 'admin', 'placement_officer')
    )
  );

-- =============================================================================
-- 4. public.anticheat_audit
-- =============================================================================
-- Immutable audit log. Read-only for all authenticated; writes are
-- service-role-only (no INSERT/UPDATE/DELETE policies at all).

create table if not exists public.anticheat_audit (
  id                bigserial primary key,
  actor_id          uuid,
  actor_type        text not null,
  action            text not null,
  subject_signal_id uuid not null references public.anticheat_signals(id) on delete cascade,
  payload           jsonb not null,
  created_at        timestamptz not null default now()
);

comment on table public.anticheat_audit is
  'Immutable audit log of every quarantine, appeal, decision, and manual override. Append-only via service role.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'anticheat_audit_actor_type_chk'
  ) then
    alter table public.anticheat_audit
      add constraint anticheat_audit_actor_type_chk
      check (actor_type in ('system', 'student', 'mentor', 'admin'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'anticheat_audit_action_chk'
  ) then
    alter table public.anticheat_audit
      add constraint anticheat_audit_action_chk
      check (action in ('quarantine', 'appeal_filed', 'appeal_decided', 'manual_override'));
  end if;
end $$;

create index if not exists anticheat_audit_signal_idx
  on public.anticheat_audit (subject_signal_id);

create index if not exists anticheat_audit_created_at_idx
  on public.anticheat_audit (created_at desc);

alter table public.anticheat_audit enable row level security;

-- All authenticated users can read the audit log (transparency).
drop policy if exists anticheat_audit_select_authenticated on public.anticheat_audit;
create policy anticheat_audit_select_authenticated on public.anticheat_audit
  for select using (auth.role() = 'authenticated');

-- No INSERT / UPDATE / DELETE policies. With RLS enabled and no permissive
-- policy, anon and authenticated are denied; only the service_role bypasses
-- RLS, so writes are service-role-only.

-- =============================================================================
-- 5. public.i18n_missing_keys
-- =============================================================================
-- Translator queue. NO policies — service-role reads only.

create table if not exists public.i18n_missing_keys (
  id            bigserial primary key,
  locale        text not null,
  key           text not null,
  seen_count    int  not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

comment on table public.i18n_missing_keys is
  'Translator queue. Client apps upsert a row whenever a locale string is missing; the i18n admin app reads these via service role.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'i18n_missing_keys_locale_chk'
  ) then
    alter table public.i18n_missing_keys
      add constraint i18n_missing_keys_locale_chk
      check (locale in ('en', 'hi', 'ta', 'te', 'mr'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'i18n_missing_keys_seen_count_chk'
  ) then
    alter table public.i18n_missing_keys
      add constraint i18n_missing_keys_seen_count_chk
      check (seen_count >= 1);
  end if;
end $$;

-- Unique (locale, key): the queue is deduped.
create unique index if not exists i18n_missing_keys_locale_key_uniq
  on public.i18n_missing_keys (locale, key);

create index if not exists i18n_missing_keys_last_seen_idx
  on public.i18n_missing_keys (last_seen_at desc);

alter table public.i18n_missing_keys enable row level security;
-- No policies: with RLS enabled and no permissive policy, anon and
-- authenticated are denied; reads/writes are service-role-only.
