-- Seed: Talent Twin embedding pipeline degraded
-- Run against any Postgres instance with the status_incidents table.
-- > psql -d "$DATABASE_URL" -f supabase/seed/010-talent-twin-status.sql

insert into public.status_incidents
  (id, title, status, started_at, resolved_at, summary, affected_subsystems)
values
  (
    'inc-2026-06-08-1',
    'Talent Twin embedding pipeline degraded',
    'investigating',
    '2026-06-08T04:00:00Z',
    null,
    'The weekly embedding rebuild cron (talent-twin-embedder) failed at 04:00 UTC. Initial diagnostics point to rate-limiting from the HuggingFace inference API. Chunks for ~42% of opted-in students were processed before the batch was throttled. Manual retry triggered; monitor for completion in the next cycle.',
    array['talent-twin-embedder']
  )
on conflict (id) do nothing;
