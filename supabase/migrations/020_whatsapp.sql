-- 020_whatsapp.sql
-- T013 — WhatsApp connection, nudge preferences, nudges, nudge responses
-- T008 (formerly base/019_nudge_preferences_ext.sql) — channel_priority +
-- whatsapp_premium_opt_in columns; folded here so the table and its deltas
-- are introduced in the same file (the original base/019 depended on this
-- table and would have failed on a fresh `supabase db push`).
-- See spec/002 data-model.md

create extension if not exists "pgcrypto";

-- whatsapp_connections
create type whatsapp_provider as enum ('meta_cloud', 'twilio');
create type whatsapp_status as enum ('active', 'paused', 'opt_out', 'disconnected', 'error');

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  phone_number varchar(20) not null,
  provider whatsapp_provider not null default 'meta_cloud',
  provider_phone_id varchar(64),
  opt_in_at timestamptz not null,
  opt_out_at timestamptz,
  last_delivery_at timestamptz,
  last_error text,
  status whatsapp_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- nudge_preferences
create table if not exists public.nudge_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  timezone varchar(64) not null default 'Asia/Kolkata',
  daily_send_local_time time not null default '08:00',
  weekly_send_local_day smallint not null default 0,
  weekly_send_local_time time not null default '10:00',
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  pause_all boolean not null default false,
  real_time_peak_nudges boolean not null default true,
  streak_risk_nudges boolean not null default true,
  whatsapp_channel boolean not null default true,
  push_channel boolean not null default true,
  dashboard_channel boolean not null default true,
  channel_priority text not null default 'in_app'
    check (channel_priority in ('in_app', 'telegram', 'discord', 'whatsapp')),
  whatsapp_premium_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

-- nudges
create type nudge_type as enum (
  'daily_morning', 'real_time_peak', 'streak_risk', 'weekly_summary', 'verification', 'pause_confirmation'
);
create type nudge_channel as enum ('whatsapp', 'push', 'dashboard');
create type nudge_trigger_source as enum (
  'cron', 'event_commit', 'event_score_recomputed',
  'event_calendar_window_opened', 'event_exam_detected', 'student_reply'
);
create type nudge_delivery_status as enum (
  'queued', 'sent', 'delivered', 'read', 'failed',
  'suppressed_quiet_hours', 'suppressed_exam_week', 'suppressed_paused', 'suppressed_opt_out'
);

create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type nudge_type not null,
  channel nudge_channel not null,
  template_id varchar(64) not null,
  trigger_source nudge_trigger_source not null,
  personalization_context jsonb,
  rendered_body text,
  send_after timestamptz not null,
  sent_at timestamptz,
  delivery_status nudge_delivery_status not null default 'queued',
  failure_reason text,
  created_at timestamptz not null default now()
);
create index if not exists nudges_user_created_idx on public.nudges(user_id, created_at desc);
create index if not exists nudges_user_type_created_idx on public.nudges(user_id, type, created_at desc);
create index if not exists nudges_queued_send_after_idx on public.nudges(send_after) where delivery_status = 'queued';

-- nudge_responses
create type nudge_response_kind as enum ('command', 'click', 'reply_text');
create type nudge_command as enum ('START', 'DONE', 'STATS', 'RANK', 'HELP', 'PAUSE', 'RESUME');

create table if not exists public.nudge_responses (
  id uuid primary key default gen_random_uuid(),
  nudge_id uuid not null references public.nudges(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  channel nudge_channel not null,
  response_kind nudge_response_kind not null,
  command nudge_command,
  raw_text text,
  target_url text,
  state_change jsonb,
  received_at timestamptz not null default now()
);
create index if not exists nudge_responses_user_idx on public.nudge_responses(user_id, received_at desc);
create index if not exists nudge_responses_nudge_idx on public.nudge_responses(nudge_id);
