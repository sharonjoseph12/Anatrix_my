-- 047_collab.sql
-- Collaborative rooms, artifacts, consent, scoring, snapshots, and audit.

create extension if not exists pgcrypto;

alter table public.users add column if not exists collab_opt_out boolean not null default false;

alter table public.anticheat_signals drop constraint if exists anticheat_signals_signal_chk;
alter table public.anticheat_signals add constraint anticheat_signals_signal_chk check (
  signal in (
    'fork_no_commits', 'commit_cluster_time', 'ai_generated_suspect',
    'copied_content_overlap', 'impossible_velocity', 'rating_delta_anomaly',
    'collab_typing_divergence'
  )
);

create table if not exists public.collab_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('self_practice', 'paired_with_mentor', 'team')),
  cohort_id uuid references public.cohorts(id),
  invited_by uuid not null references public.users(id),
  scheduled_start timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 30 and 120),
  language text not null check (language in ('javascript', 'typescript', 'python', 'go', 'rust', 'other')),
  sandbox_kind text not null check (sandbox_kind in ('webcontainer', 'firecracker')),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  consent_required boolean not null default false,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > scheduled_start)
);

create table if not exists public.collab_consents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.collab_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id),
  grantee_user_id uuid not null references public.users(id),
  scopes text[] not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  constraint collab_consents_scopes_chk check (
    scopes <@ array['observe_live', 'observe_recorded', 'read_teamwork_score']::text[]
  )
);

create table if not exists public.collab_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.collab_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id),
  role text not null check (role in ('host', 'participant', 'observer', 'recruiter_observer')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  left_reason text check (left_reason in ('ended', 'left', 'kicked', 'network_lost', 'account_deleted')),
  opt_out_teamwork boolean not null default false,
  consent_id uuid references public.collab_consents(id) on delete set null,
  unique (room_id, user_id)
);

create table if not exists public.collab_events (
  id bigserial primary key,
  room_id uuid not null references public.collab_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id),
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  seq bigint not null,
  created_at timestamptz not null default now(),
  unique (room_id, seq)
);

create table if not exists public.collab_artifacts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.collab_rooms(id),
  code_snapshot_url text not null,
  transcript_url text,
  events_url text not null,
  language text not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  ended_at timestamptz not null default now()
);

create table if not exists public.teamwork_scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.collab_rooms(id),
  user_id uuid references public.users(id),
  score integer not null check (score between 0 and 100),
  sub_scores_json jsonb not null,
  breakdown_json jsonb not null,
  computed_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.collab_recordings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.collab_rooms(id),
  observer_user_id uuid not null references public.users(id),
  recording_url text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  redacted boolean not null default false,
  purge_after timestamptz not null
);

create table if not exists public.collab_snapshots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.collab_rooms(id) on delete cascade,
  seq_at_snapshot bigint not null,
  snapshot_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.collab_audit (
  id bigserial primary key,
  actor_id uuid references public.users(id),
  actor_type text not null check (actor_type in ('system', 'student', 'mentor', 'recruiter', 'faculty', 'admin')),
  action text not null check (action in (
    'consent_granted', 'consent_revoked', 'consent_expired',
    'observer_joined', 'observer_left', 'opt_out_changed',
    'sandbox_boot', 'sandbox_shutdown', 'recording_started',
    'recording_purged', 'flag_raised'
  )),
  subject_room_id uuid not null references public.collab_rooms(id),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_collab_rooms_status_start on public.collab_rooms(status, scheduled_start);
create index if not exists idx_collab_rooms_cohort_status on public.collab_rooms(cohort_id, status);
create index if not exists idx_collab_rooms_invited_by on public.collab_rooms(invited_by, created_at desc);
create index if not exists idx_collab_participants_room on public.collab_participants(room_id);
create index if not exists idx_collab_participants_user on public.collab_participants(user_id);
create index if not exists idx_collab_events_room_seq on public.collab_events(room_id, seq desc);
create index if not exists idx_collab_events_room_type on public.collab_events(room_id, event_type, created_at desc);
create index if not exists idx_collab_events_user_created on public.collab_events(user_id, created_at desc);
create index if not exists idx_collab_artifacts_room on public.collab_artifacts(room_id);
create index if not exists idx_teamwork_scores_user on public.teamwork_scores(user_id, computed_at desc);
create index if not exists idx_teamwork_scores_room on public.teamwork_scores(room_id);
create index if not exists idx_collab_recordings_observer on public.collab_recordings(observer_user_id, started_at desc);
create index if not exists idx_collab_recordings_purge on public.collab_recordings(purge_after) where recording_url is not null;
create index if not exists idx_collab_consents_room_user on public.collab_consents(room_id, user_id);
create index if not exists idx_collab_consents_grantee on public.collab_consents(grantee_user_id, granted_at desc);
create index if not exists idx_collab_snapshots_room_seq on public.collab_snapshots(room_id, seq_at_snapshot desc);
create index if not exists idx_collab_snapshots_created on public.collab_snapshots(created_at);
create index if not exists idx_collab_audit_room on public.collab_audit(subject_room_id, created_at desc);
create index if not exists idx_collab_audit_actor on public.collab_audit(actor_id, created_at desc);
create index if not exists idx_collab_audit_action on public.collab_audit(action, created_at desc);

alter table public.collab_rooms enable row level security;
alter table public.collab_participants enable row level security;
alter table public.collab_events enable row level security;
alter table public.collab_artifacts enable row level security;
alter table public.teamwork_scores enable row level security;
alter table public.collab_recordings enable row level security;
alter table public.collab_consents enable row level security;
alter table public.collab_snapshots enable row level security;
alter table public.collab_audit enable row level security;

drop policy if exists collab_rooms_host_select on public.collab_rooms;
create policy collab_rooms_host_select on public.collab_rooms for select using (invited_by = auth.uid());
drop policy if exists collab_rooms_participant_select on public.collab_rooms;
create policy collab_rooms_participant_select on public.collab_rooms for select using (
  exists (select 1 from public.collab_participants cp where cp.room_id = collab_rooms.id and cp.user_id = auth.uid())
);
drop policy if exists collab_rooms_cohort_select on public.collab_rooms;
create policy collab_rooms_cohort_select on public.collab_rooms for select using (
  cohort_id is not null and exists (
    select 1 from public.cohort_members cm where cm.cohort_id = collab_rooms.cohort_id and cm.user_id = auth.uid()
  )
);
drop policy if exists collab_participants_self_select on public.collab_participants;
create policy collab_participants_self_select on public.collab_participants for select using (user_id = auth.uid());
drop policy if exists collab_participants_host_select on public.collab_participants;
create policy collab_participants_host_select on public.collab_participants for select using (
  exists (select 1 from public.collab_rooms cr where cr.id = collab_participants.room_id and cr.invited_by = auth.uid())
);
drop policy if exists collab_events_participant_select on public.collab_events;
create policy collab_events_participant_select on public.collab_events for select using (
  exists (select 1 from public.collab_participants cp where cp.room_id = collab_events.room_id and cp.user_id = auth.uid())
);
drop policy if exists collab_artifacts_participant_select on public.collab_artifacts;
create policy collab_artifacts_participant_select on public.collab_artifacts for select using (
  exists (select 1 from public.collab_participants cp where cp.room_id = collab_artifacts.room_id and cp.user_id = auth.uid())
);
drop policy if exists teamwork_scores_self_select on public.teamwork_scores;
create policy teamwork_scores_self_select on public.teamwork_scores for select using (user_id = auth.uid());
drop policy if exists teamwork_scores_observer_select on public.teamwork_scores;
create policy teamwork_scores_observer_select on public.teamwork_scores for select using (
  exists (
    select 1 from public.collab_consents cc
    where cc.room_id = teamwork_scores.room_id
      and cc.grantee_user_id = auth.uid()
      and 'read_teamwork_score' = any(cc.scopes)
      and cc.revoked_at is null
      and (cc.expires_at is null or cc.expires_at > now())
  )
);
drop policy if exists collab_recordings_observer_select on public.collab_recordings;
create policy collab_recordings_observer_select on public.collab_recordings for select using (observer_user_id = auth.uid());
drop policy if exists collab_recordings_participant_meta_select on public.collab_recordings;
create policy collab_recordings_participant_meta_select on public.collab_recordings for select using (
  exists (select 1 from public.collab_participants cp where cp.room_id = collab_recordings.room_id and cp.user_id = auth.uid())
);
drop policy if exists collab_consents_giver_select on public.collab_consents;
create policy collab_consents_giver_select on public.collab_consents for select using (user_id = auth.uid());
drop policy if exists collab_consents_grantee_select on public.collab_consents;
create policy collab_consents_grantee_select on public.collab_consents for select using (grantee_user_id = auth.uid());
drop policy if exists collab_snapshots_participant_select on public.collab_snapshots;
create policy collab_snapshots_participant_select on public.collab_snapshots for select using (
  exists (select 1 from public.collab_participants cp where cp.room_id = collab_snapshots.room_id and cp.user_id = auth.uid())
);
drop policy if exists collab_audit_admin_select on public.collab_audit;
create policy collab_audit_admin_select on public.collab_audit for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

comment on column public.users.collab_opt_out is
  'When true, future collaboration participants are excluded from teamwork scoring.';
