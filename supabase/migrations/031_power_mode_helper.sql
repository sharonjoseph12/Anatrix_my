-- 031_power_mode_helper.sql
-- T058 — A simple view so the dashboard and score-weight switch agree on the
-- "Power Mode is currently active" definition in one place.

create or replace view public.v_power_mode_status as
select
  u.id as user_id,
  coalesce(u.power_mode_active, false) as declared_active,
  et.last_heartbeat_at,
  case
    when et.last_heartbeat_at is null then false
    when et.last_heartbeat_at > (now() - (
      coalesce(
        nullif(current_setting('app.power_mode_freshness_hours', true), '')::int,
        2
      ) || ' hours')::interval
    ) then true
    else false
  end as power_mode_active
from public.users u
left join lateral (
  select max(last_heartbeat_at) as last_heartbeat_at
  from public.extension_telemetry
  where user_id = u.id
) et on true;

grant select on public.v_power_mode_status to authenticated, anon;
