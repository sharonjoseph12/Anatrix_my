-- 043_deep_signal_capture.sql
-- 006 — Deep Signal Capture
--   spec: specs/006-deep-signal-capture/spec.md
--   data: specs/006-deep-signal-capture/data-model.md
--
-- Six new tables: ide_sessions, ide_aggregates, biometric_connections,
-- biometric_aggregates, peak_window_inferences, signal_audit. All
-- strictly additive. Every CREATE TABLE is wrapped in a DO block
-- guarded by `exception when duplicate_object` so re-applying is a
-- no-op. signal_audit is doubly protected: REVOKE UPDATE, DELETE plus
-- RLS (per FR-PRI-008).

-- =============================================================================
-- 0. Extensions
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pgsodium;

-- =============================================================================
-- 1. public.ide_sessions
-- =============================================================================

do $$
begin
  create table public.ide_sessions (
    id                              uuid         primary key default gen_random_uuid(),
    device_id                       uuid         not null,
    student_id                      uuid         not null references public.users(id) on delete cascade,
    started_at                      timestamptz  not null,
    ended_at                        timestamptz  not null,
    duration_seconds                int          not null,
    editor                          text         not null,
    project_hash                    text         not null,
    language                        text         not null,
    keystroke_entropy_bpm           numeric(6,2) not null,
    debug_session_duration_seconds  int          not null default 0,
    debug_step_ratio                numeric(4,2) not null default 0,
    ast_refactor_distance           int          not null default 0,
    time_in_file_seconds            int          not null default 0,
    test_run_count                  int          not null default 0,
    error_resolution_latency_ms     int          not null default 0,
    raw_partial_capture             boolean      not null default false,
    uploaded_at                     timestamptz  not null default now()
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_sessions
    add constraint ide_sessions_duration_chk
    check (duration_seconds between 60 and 1800);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_sessions
    add constraint ide_sessions_editor_chk
    check (editor in ('vscode', 'cursor'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_sessions
    add constraint ide_sessions_language_chk
    check (language in ('python', 'typescript', 'javascript', 'java', 'go', 'cpp', 'mixed'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_sessions
    add constraint ide_sessions_keystroke_entropy_chk
    check (keystroke_entropy_bpm between 0 and 20);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_sessions
    add constraint ide_sessions_debug_step_ratio_chk
    check (debug_step_ratio between 0 and 1);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_sessions
    add constraint ide_sessions_ast_refactor_distance_chk
    check (ast_refactor_distance >= 0);
exception when duplicate_object then null;
end $$;

create index if not exists ide_sessions_student_started_idx
  on public.ide_sessions (student_id, started_at desc);
create index if not exists ide_sessions_device_started_idx
  on public.ide_sessions (device_id, started_at desc);
create index if not exists ide_sessions_uploaded_at_idx
  on public.ide_sessions (uploaded_at);

comment on table  public.ide_sessions is
  'One row per <= 30-min coding session captured by the Antarix IDE extension (VS Code or Cursor). Raw keystrokes and source code are never captured. Retention: 30 days from uploaded_at, then rolled up into ide_aggregates and hard-deleted.';
comment on column public.ide_sessions.id is
  'Primary key. UUIDv4.';
comment on column public.ide_sessions.device_id is
  'Per-install UUID generated client-side; stable across sessions for that install. Used for device-scoped purge on uninstall (FR-IDE-006).';
comment on column public.ide_sessions.student_id is
  'FK public.users(id) ON DELETE CASCADE. Denormalised for fast student lookup; cascade on user delete (DPDP erasure).';
comment on column public.ide_sessions.started_at is
  'Session start time (UTC, timestamptz).';
comment on column public.ide_sessions.ended_at is
  'Session end time (UTC, timestamptz). Must be > started_at.';
comment on column public.ide_sessions.duration_seconds is
  'Session duration in seconds. CHECK between 60 and 1800 (30 min cap; sub-60s sessions discarded client-side).';
comment on column public.ide_sessions.editor is
  'IDE editor that captured the session. One of vscode, cursor.';
comment on column public.ide_sessions.project_hash is
  'SHA-256 of the project root path; the path itself is never stored.';
comment on column public.ide_sessions.language is
  'Most-frequent language in the session. One of python, typescript, javascript, java, go, cpp, mixed.';
comment on column public.ide_sessions.keystroke_entropy_bpm is
  'Shannon entropy of key codes in bits per minute. numeric(6,2), CHECK between 0 and 20. No content is captured.';
comment on column public.ide_sessions.debug_session_duration_seconds is
  'Total seconds spent in debugger sessions during this coding session.';
comment on column public.ide_sessions.debug_step_ratio is
  'Step events divided by total debug time. numeric(4,2), CHECK between 0 and 1.';
comment on column public.ide_sessions.ast_refactor_distance is
  'Nodes added + removed weighted by depth delta. CHECK >= 0. Computed client-side in a Web Worker; server never receives parsed ASTs.';
comment on column public.ide_sessions.time_in_file_seconds is
  'Total seconds the cursor spent inside a file (focus time).';
comment on column public.ide_sessions.test_run_count is
  'Number of test runs triggered during the session.';
comment on column public.ide_sessions.error_resolution_latency_ms is
  'Milliseconds from first diagnostic to cleared.';
comment on column public.ide_sessions.raw_partial_capture is
  'True if the user revoked a sub-scope at the OS level. Score contribution is recalculated against the partial aggregate set.';
comment on column public.ide_sessions.uploaded_at is
  'Server-side timestamp at which the row landed. Default now().';

alter table public.ide_sessions enable row level security;

drop policy if exists ide_sessions_student_read on public.ide_sessions;
create policy ide_sessions_student_read on public.ide_sessions
  for select using (auth.uid() = student_id);

-- =============================================================================
-- 2. public.ide_aggregates
-- =============================================================================

do $$
begin
  create table public.ide_aggregates (
    id                       uuid         primary key default gen_random_uuid(),
    device_id                uuid         not null,
    student_id               uuid         not null references public.users(id) on delete cascade,
    day                      date         not null,
    session_count            int          not null default 0,
    total_active_seconds     int          not null default 0,
    language_breakdown_json  jsonb        not null default '{}'::jsonb,
    productivity_score_raw   numeric(5,2) not null default 0,
    score_contribution       numeric(4,2) not null default 0,
    period_type              text         not null,
    period_start             date         not null,
    computed_at              timestamptz  not null default now()
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_aggregates
    add constraint ide_aggregates_session_count_chk
    check (session_count >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_aggregates
    add constraint ide_aggregates_total_active_seconds_chk
    check (total_active_seconds >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_aggregates
    add constraint ide_aggregates_productivity_score_raw_chk
    check (productivity_score_raw between 0 and 100);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_aggregates
    add constraint ide_aggregates_score_contribution_chk
    check (score_contribution between 0 and 3);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ide_aggregates
    add constraint ide_aggregates_period_type_chk
    check (period_type in ('daily', 'monthly'));
exception when duplicate_object then null;
end $$;

create index if not exists ide_aggregates_student_period_start_idx
  on public.ide_aggregates (student_id, period_start desc);
create index if not exists ide_aggregates_student_type_period_idx
  on public.ide_aggregates (student_id, period_type, period_start desc);
create unique index if not exists ide_aggregates_daily_device_uidx
  on public.ide_aggregates (device_id, period_type, period_start)
  where period_type = 'daily';
create unique index if not exists ide_aggregates_monthly_student_uidx
  on public.ide_aggregates (student_id, period_type, period_start)
  where period_type = 'monthly';

comment on table  public.ide_aggregates is
  'Daily or monthly IDE rollup. Daily rows live for 30 days; monthly rows live indefinitely until user erasure. score_contribution is capped at 3 percentage points (FR-CAP-001).';
comment on column public.ide_aggregates.day is
  'Used for daily rows; first day of month for monthly rows. Redundant with period_start but kept for query ergonomics.';
comment on column public.ide_aggregates.session_count is
  'Number of ide_sessions rolled up. CHECK >= 0.';
comment on column public.ide_aggregates.total_active_seconds is
  'Sum of duration_seconds across rolled-up sessions. CHECK >= 0.';
comment on column public.ide_aggregates.language_breakdown_json is
  'Per-language share, e.g. {"python": 0.6, "typescript": 0.4}. Default empty object.';
comment on column public.ide_aggregates.productivity_score_raw is
  'Server-computed raw score in [0, 100]. Never exposed to client pre-cap.';
comment on column public.ide_aggregates.score_contribution is
  'Capped contribution to the Skill Proof Score in [0, 3] percentage points. Enforced server-side (FR-CAP-001).';
comment on column public.ide_aggregates.period_type is
  'One of daily, monthly. Drives the partial unique indexes below.';
comment on column public.ide_aggregates.period_start is
  'First day of the period (the day for daily rows, the first day of the month for monthly rows).';

alter table public.ide_aggregates enable row level security;

drop policy if exists ide_aggregates_student_read on public.ide_aggregates;
create policy ide_aggregates_student_read on public.ide_aggregates
  for select using (auth.uid() = student_id);

-- =============================================================================
-- 3. public.biometric_connections
-- =============================================================================

do $$
begin
  create table public.biometric_connections (
    id                              uuid         primary key default gen_random_uuid(),
    student_id                      uuid         not null references public.users(id) on delete cascade,
    provider                        text         not null,
    status                          text         not null default 'connected',
    oauth_refresh_token_encrypted  text,
    last_sync_at                    timestamptz,
    last_error                      text,
    connected_at                    timestamptz  not null default now(),
    scopes_json                     jsonb        not null
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_connections
    add constraint biometric_connections_provider_chk
    check (provider in ('healthkit', 'google_fit', 'oura', 'whoop'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_connections
    add constraint biometric_connections_status_chk
    check (status in ('connected', 'expired', 'disconnected'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_connections
    add constraint biometric_connections_last_error_len_chk
    check (last_error is null or char_length(last_error) <= 500);
exception when duplicate_object then null;
end $$;

create unique index if not exists biometric_connections_student_provider_uidx
  on public.biometric_connections (student_id, provider);
create index if not exists biometric_connections_status_last_sync_idx
  on public.biometric_connections (status, last_sync_at);

comment on table  public.biometric_connections is
  'One row per (user, provider) OAuth connection. The refresh token is pgsodium-encrypted at rest. Mobile-handled providers (healthkit, google_fit) leave the token column null.';
comment on column public.biometric_connections.provider is
  'One of healthkit, google_fit, oura, whoop. CHECK-constrained.';
comment on column public.biometric_connections.status is
  'Connection lifecycle. One of connected, expired, disconnected. Default connected.';
comment on column public.biometric_connections.oauth_refresh_token_encrypted is
  'pgsodium-encrypted OAuth refresh token. Nullable because healthkit and google_fit are mobile-handled and never store a server-side refresh token.';
comment on column public.biometric_connections.last_sync_at is
  'Timestamp of the most recent successful sync. Nullable until the first sync completes.';
comment on column public.biometric_connections.last_error is
  'Truncated to 500 chars. Populated on the most recent failed sync attempt.';
comment on column public.biometric_connections.connected_at is
  'Timestamp at which the connection was created. Default now().';
comment on column public.biometric_connections.scopes_json is
  'Array of granted scopes, e.g. ["sleep","hrv","resting_hr","readiness"]. At least one entry required; enforced at the API layer.';

alter table public.biometric_connections enable row level security;

drop policy if exists biometric_connections_student_read on public.biometric_connections;
create policy biometric_connections_student_read on public.biometric_connections
  for select using (auth.uid() = student_id);

-- =============================================================================
-- 4. public.biometric_aggregates
-- =============================================================================

do $$
begin
  create table public.biometric_aggregates (
    id                       uuid         primary key default gen_random_uuid(),
    connection_id            uuid         not null references public.biometric_connections(id) on delete cascade,
    student_id               uuid         not null references public.users(id) on delete cascade,
    provider                 text         not null,
    period_type              text         not null,
    period_start             date         not null,
    sleep_duration_minutes   int,
    sleep_quality_score      int,
    hrv_ms                   int,
    resting_hr_bpm           int,
    daily_readiness_score    int,
    source_hash              text         not null,
    created_at               timestamptz  not null default now()
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_aggregates
    add constraint biometric_aggregates_provider_chk
    check (provider in ('healthkit', 'google_fit', 'oura', 'whoop'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_aggregates
    add constraint biometric_aggregates_period_type_chk
    check (period_type in ('daily', 'monthly'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_aggregates
    add constraint biometric_aggregates_sleep_duration_chk
    check (sleep_duration_minutes is null or (sleep_duration_minutes between 0 and 1440));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_aggregates
    add constraint biometric_aggregates_sleep_quality_chk
    check (sleep_quality_score is null or (sleep_quality_score between 0 and 100));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_aggregates
    add constraint biometric_aggregates_hrv_ms_chk
    check (hrv_ms is null or (hrv_ms between 0 and 300));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_aggregates
    add constraint biometric_aggregates_resting_hr_chk
    check (resting_hr_bpm is null or (resting_hr_bpm between 20 and 200));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.biometric_aggregates
    add constraint biometric_aggregates_readiness_chk
    check (daily_readiness_score is null or (daily_readiness_score between 0 and 100));
exception when duplicate_object then null;
end $$;

create index if not exists biometric_aggregates_student_provider_period_idx
  on public.biometric_aggregates (student_id, provider, period_start desc);
create index if not exists biometric_aggregates_connection_type_period_idx
  on public.biometric_aggregates (connection_id, period_type, period_start desc);
create unique index if not exists biometric_aggregates_daily_connection_uidx
  on public.biometric_aggregates (connection_id, period_type, period_start)
  where period_type = 'daily';
create unique index if not exists biometric_aggregates_monthly_student_provider_uidx
  on public.biometric_aggregates (student_id, provider, period_type, period_start)
  where period_type = 'monthly';

comment on table  public.biometric_aggregates is
  'Daily or monthly biometric summary per provider. HealthKit and Google Fit rows come from the mobile app; Oura and Whoop rows come from the server-side biometric-correlator edge function. Raw rows retained 90 days, then rolled up (FR-BIO-006).';
comment on column public.biometric_aggregates.connection_id is
  'FK biometric_connections(id) ON DELETE CASCADE. A deleted connection removes its aggregates.';
comment on column public.biometric_aggregates.student_id is
  'FK public.users(id) ON DELETE CASCADE. DPDP erasure cascades here.';
comment on column public.biometric_aggregates.provider is
  'Denormalised copy of biometric_connections.provider. One of healthkit, google_fit, oura, whoop.';
comment on column public.biometric_aggregates.period_type is
  'One of daily, monthly. Drives the partial unique indexes below.';
comment on column public.biometric_aggregates.period_start is
  'First day of the period.';
comment on column public.biometric_aggregates.sleep_duration_minutes is
  'Total sleep in minutes. Nullable; CHECK between 0 and 1440 when present.';
comment on column public.biometric_aggregates.sleep_quality_score is
  'Provider-normalised sleep quality in [0, 100]. Nullable.';
comment on column public.biometric_aggregates.hrv_ms is
  'Heart rate variability in milliseconds. Nullable; CHECK between 0 and 300 when present.';
comment on column public.biometric_aggregates.resting_hr_bpm is
  'Resting heart rate in bpm. Nullable; CHECK between 20 and 200 when present.';
comment on column public.biometric_aggregates.daily_readiness_score is
  'Provider-specific readiness score normalised to [0, 100]. Nullable; only Oura and Whoop expose this.';
comment on column public.biometric_aggregates.source_hash is
  'SHA-256 of (provider, period_start, all numeric fields). Used to detect duplicate uploads and to surface a "what we learned" proof-of-content in the privacy center.';
comment on column public.biometric_aggregates.created_at is
  'Server-side insert timestamp. Default now().';

alter table public.biometric_aggregates enable row level security;

drop policy if exists biometric_aggregates_student_read on public.biometric_aggregates;
create policy biometric_aggregates_student_read on public.biometric_aggregates
  for select using (auth.uid() = student_id);

-- =============================================================================
-- 5. public.peak_window_inferences
-- =============================================================================

do $$
begin
  create table public.peak_window_inferences (
    id                       uuid         primary key default gen_random_uuid(),
    student_id               uuid         not null references public.users(id) on delete cascade,
    window_start             timestamptz  not null,
    window_end               timestamptz  not null,
    confidence               numeric(3,2) not null,
    biometric_inputs_hash    text,
    ide_inputs_hash          text,
    detector_inputs_hash     text         not null,
    source_mix               jsonb        not null default '{}'::jsonb,
    created_at               timestamptz  not null default now()
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.peak_window_inferences
    add constraint peak_window_inferences_confidence_chk
    check (confidence between 0 and 1);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.peak_window_inferences
    add constraint peak_window_inferences_window_order_chk
    check (window_end > window_start);
exception when duplicate_object then null;
end $$;

create index if not exists peak_window_inferences_student_created_idx
  on public.peak_window_inferences (student_id, created_at desc);
create index if not exists peak_window_inferences_created_at_idx
  on public.peak_window_inferences (created_at);

comment on table  public.peak_window_inferences is
  'One row per inference cycle. The biometric-correlator edge function writes one row per active student per day. Extends (does not replace) the 002 peak-window detector. Retention 30 days from created_at, then hard-deleted.';
comment on column public.peak_window_inferences.student_id is
  'FK public.users(id) ON DELETE CASCADE.';
comment on column public.peak_window_inferences.window_start is
  'Start of the inferred peak window (UTC).';
comment on column public.peak_window_inferences.window_end is
  'End of the inferred peak window (UTC). CHECK > window_start.';
comment on column public.peak_window_inferences.confidence is
  'Model confidence in [0, 1]. numeric(3,2), CHECK-constrained.';
comment on column public.peak_window_inferences.biometric_inputs_hash is
  'SHA-256 of the biometric aggregates used. Nullable; null when no biometric input contributed.';
comment on column public.peak_window_inferences.ide_inputs_hash is
  'SHA-256 of the IDE aggregates used. Nullable; null when no IDE input contributed.';
comment on column public.peak_window_inferences.detector_inputs_hash is
  'SHA-256 of the 002 peak-window detector output that this inference extends. NOT NULL — always cites the 002 baseline.';
comment on column public.peak_window_inferences.source_mix is
  'Per-source weight used in the merge, e.g. {"biometric": 0.3, "ide": 0.4, "002_detector": 0.3}. Default empty object.';
comment on column public.peak_window_inferences.created_at is
  'Server-side insert timestamp. Default now().';

alter table public.peak_window_inferences enable row level security;

drop policy if exists peak_window_inferences_student_read on public.peak_window_inferences;
create policy peak_window_inferences_student_read on public.peak_window_inferences
  for select using (auth.uid() = student_id);

-- =============================================================================
-- 6. public.signal_audit
-- =============================================================================
-- Append-only audit log. Every signal upload, toggle flip, privacy page
-- view, "Delete all" action, and admin audit read writes one row. The
-- payload itself is never stored; only its hash, provider, byte count,
-- and actor. Enforced as append-only by REVOKE UPDATE, DELETE below
-- (FR-PRI-008) plus a restrictive RLS policy.

do $$
begin
  create table public.signal_audit (
    id               bigserial   primary key,
    actor_id         uuid        references public.users(id) on delete set null,
    actor_type       text        not null,
    student_id       uuid        not null references public.users(id) on delete cascade,
    provider         text        not null,
    action           text        not null,
    byte_count       int         not null default 0,
    aggregate_hash   text,
    payload_redacted boolean     not null default true,
    created_at       timestamptz not null default now()
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.signal_audit
    add constraint signal_audit_actor_type_chk
    check (actor_type in ('system', 'student', 'admin', 'college_admin'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.signal_audit
    add constraint signal_audit_provider_chk
    check (provider in (
      'ide_vscode',
      'ide_cursor',
      'biometric_healthkit',
      'biometric_google_fit',
      'biometric_oura',
      'biometric_whoop',
      'privacy_center',
      'admin_audit',
      'dpdp_erasure'
    ));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.signal_audit
    add constraint signal_audit_action_chk
    check (action in (
      'enable',
      'disable',
      'upload',
      'read',
      'delete_all',
      'delete_one',
      'audit_read',
      'erasure_complete'
    ));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.signal_audit
    add constraint signal_audit_byte_count_chk
    check (byte_count >= 0);
exception when duplicate_object then null;
end $$;

create index if not exists signal_audit_student_created_idx
  on public.signal_audit (student_id, created_at desc);
create index if not exists signal_audit_provider_action_created_idx
  on public.signal_audit (provider, action, created_at desc);
create index if not exists signal_audit_actor_created_idx
  on public.signal_audit (actor_id, created_at desc);

comment on table  public.signal_audit is
  'Append-only audit log of every signal upload, toggle, privacy page view, and DPDP erasure event. Doubly protected: REVOKE UPDATE, DELETE plus a restrictive RLS policy (FR-PRI-008). The payload itself is never stored; only its hash, provider, byte count, and actor.';
comment on column public.signal_audit.id is
  'Primary key. bigserial.';
comment on column public.signal_audit.actor_id is
  'FK public.users(id) ON DELETE SET NULL. Nullable for system-actor events (nightly cron). Set to NULL when the actor is deleted so the audit row survives.';
comment on column public.signal_audit.actor_type is
  'One of system, student, admin, college_admin. CHECK-constrained.';
comment on column public.signal_audit.student_id is
  'FK public.users(id) ON DELETE CASCADE. The data subject — the student whose data was touched. DPDP erasure cascades here.';
comment on column public.signal_audit.provider is
  'The signal source. One of ide_vscode, ide_cursor, biometric_healthkit, biometric_google_fit, biometric_oura, biometric_whoop, privacy_center, admin_audit, dpdp_erasure. CHECK-constrained.';
comment on column public.signal_audit.action is
  'The action performed. One of enable, disable, upload, read, delete_all, delete_one, audit_read, erasure_complete. CHECK-constrained.';
comment on column public.signal_audit.byte_count is
  'Size of the payload the audit is about; informational only. CHECK >= 0.';
comment on column public.signal_audit.aggregate_hash is
  'SHA-256 of the payload. The payload itself is never stored. Nullable for read/enable events that have no payload.';
comment on column public.signal_audit.payload_redacted is
  'Always true. Column exists for future-proofing only (in case the data model ever needs to mark a row as carrying payload).';
comment on column public.signal_audit.created_at is
  'Server-side insert timestamp. Default now(). Retention: 7 years per DPDP Section 8(4).';

alter table public.signal_audit enable row level security;

-- Student sees own rows, excluding admin audit_read events on them.
drop policy if exists signal_audit_student_read on public.signal_audit;
create policy signal_audit_student_read on public.signal_audit
  for select using (
    auth.uid() = student_id
    and action <> 'audit_read'
  );

-- Admins and college admins can read all audit rows (read-only).
drop policy if exists signal_audit_admin_read on public.signal_audit;
create policy signal_audit_admin_read on public.signal_audit
  for select using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'college_admin')
  );

-- =============================================================================
-- 7. Append-only enforcement on signal_audit
-- =============================================================================
-- Per FR-PRI-008: REVOKE UPDATE, DELETE on signal_audit from every role
-- including service_role. The only allowed operation is INSERT (via
-- service_role, which retains INSERT). The nightly integrity check
-- (signal-audit-integrity-check) verifies this invariant.

revoke update, delete on public.signal_audit from authenticated, anon, service_role;

-- =============================================================================
-- 7. dpdp_erasure_requests — process-control table for DPDP data-principal
--    erasure requests. Not student-facing; service-role writes only.
-- =============================================================================
-- Per FR-PRI-006 / DPDP Act 2023 Section 8: every erasure request has a
-- 30-day statutory window (DPDP_ERASURE_WINDOW_DAYS). The signal-purge
-- cron processes completed_WINDOW rows on day 31; this table is the
-- application-level tracking ledger.

do $$ begin
  create table if not exists public.dpdp_erasure_requests (
    id            uuid primary key default gen_random_uuid(),
    student_id    uuid        not null references public.users(id) on delete cascade,
    status        text        not null check (status in ('pending','in_progress','complete','failed')),
    requested_at  timestamptz not null default now(),
    due_by        timestamptz not null,
    completed_at  timestamptz
  );
exception when duplicate_object then null;
end $$;

create index if not exists dpdp_erasure_requests_student_idx
  on public.dpdp_erasure_requests (student_id, status);

alter table public.dpdp_erasure_requests enable row level security;

-- Service role only: INSERT + read for the cron. Students see nothing.
drop policy if exists dpdp_erasure_requests_service_all on public.dpdp_erasure_requests;
create policy dpdp_erasure_requests_service_all on public.dpdp_erasure_requests
  for all using (auth.role() = 'service_role');

comment on table public.dpdp_erasure_requests is 'DPDP Act 2023 data-principal-rights erasure request tracking';
comment on column public.dpdp_erasure_requests.id is 'PK';
comment on column public.dpdp_erasure_requests.student_id is 'The student requesting erasure';
comment on column public.dpdp_erasure_requests.status is 'Current status of the erasure request';
comment on column public.dpdp_erasure_requests.requested_at is 'When the request was submitted';
comment on column public.dpdp_erasure_requests.due_by is 'Statutory deadline (requested_at + 30 days)';
comment on column public.dpdp_erasure_requests.completed_at is 'When the signal-purge cron completed the erasure';

-- =============================================================================
-- End of 043_deep_signal_capture.sql
-- =============================================================================
