-- supabase/migrations/040_status_page.sql
-- T-PUB-STATUS — additive data layer for the public status page.
-- Edge Function: supabase/functions/status-page-data/index.ts
-- Static page:  apps/web/public/status.html
-- Design doc:   docs/status-page.md
--
-- Two admin-managed tables, both RLS-enabled with no policies (service-role
-- only). The status-page-data Edge Function reads them with the service-role
-- client; everyone else (anon, authenticated) sees an empty row set.
--
-- Idempotent: every DDL uses IF NOT EXISTS, every seed uses ON CONFLICT DO
-- NOTHING. Re-running this migration is safe.

--------------------------------------------------------------------------------
-- 1. status_incidents
--------------------------------------------------------------------------------

create table if not exists public.status_incidents (
  id                  text        primary key,
  title               text        not null,
  status              text        not null
                                  check (status in ('investigating','identified','monitoring','resolved')),
  started_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  summary             text,
  affected_subsystems text[]      not null default '{}'
);

create index if not exists status_incidents_started_at_idx
  on public.status_incidents (started_at desc);

create index if not exists status_incidents_status_idx
  on public.status_incidents (status)
  where status <> 'resolved';

alter table public.status_incidents enable row level security;

--------------------------------------------------------------------------------
-- 2. status_scheduled_maintenances
--------------------------------------------------------------------------------

create table if not exists public.status_scheduled_maintenances (
  id                  text        primary key,
  title               text        not null,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  description         text,
  affected_subsystems text[]      not null default '{}'
);

create index if not exists status_scheduled_maintenances_starts_at_idx
  on public.status_scheduled_maintenances (starts_at asc);

alter table public.status_scheduled_maintenances enable row level security;

-- No policies. RLS is on; anon + authenticated see zero rows. The
-- status-page-data Edge Function reads via the service-role key.

--------------------------------------------------------------------------------
-- 3. Seed data
--    1 resolved incident, 1 investigating incident, 1 upcoming maintenance.
--    Replace / delete these rows freely — they're just placeholders so the
--    status page is not empty on first deploy.
--------------------------------------------------------------------------------

insert into public.status_incidents
  (id, title, status, started_at, resolved_at, summary, affected_subsystems)
values
  (
    'inc-2026-05-12-1',
    'WhatsApp template rejection',
    'resolved',
    '2026-05-12T10:00:00Z',
    '2026-05-12T14:00:00Z',
    'Meta Business Manager rejected the cohort-percentile template during the morning review. We re-submitted with revised copy and it was approved at 13:42 UTC. WhatsApp delivery was paused for ~4 hours; push notifications continued to work as the fallback channel.',
    array['whatsapp-send']
  ),
  (
    'inc-2026-06-06-1',
    'Elevated credential-vc-resolve latency',
    'investigating',
    '2026-06-06T08:00:00Z',
    null,
    'Public credential resolution p95 latency has been above 800ms since 08:00 UTC. Initial data points at Supabase pgbouncer connection-pool saturation during the US morning. We are scaling the pool and monitoring; no credential verifications have failed, just slowed.',
    array['credential-vc-resolve']
  )
on conflict (id) do nothing;

insert into public.status_scheduled_maintenances
  (id, title, starts_at, ends_at, description, affected_subsystems)
values
  (
    'maint-2026-06-15-supabase-upgrade',
    'Supabase project upgrade v15 → v16',
    '2026-06-15T02:00:00Z',
    '2026-06-15T04:00:00Z',
    'Supabase is upgrading the underlying Postgres from v15 to v16. Expect ~2 minutes of read-only mode per region; in-flight API requests will see 503 responses with a Retry-After header. The status page itself is not affected (it is served from a separate region).',
    array[
      'core-platform',
      'credential-vc-resolve',
      'ai-coach',
      'whatsapp-send',
      'nudge-dispatch',
      'github-sync',
      'calendar-sync'
    ]
  )
on conflict (id) do nothing;
