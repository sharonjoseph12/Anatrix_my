-- 024_extension_telemetry.sql
-- T017 — heartbeat rows from the Power Mode Chrome Extension

create table if not exists public.extension_telemetry (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  extension_version varchar(32) not null,
  last_heartbeat_at timestamptz not null,
  browser varchar(32),
  created_at timestamptz not null default now()
);
create index if not exists extension_telemetry_user_heartbeat_idx
  on public.extension_telemetry(user_id, last_heartbeat_at desc);
