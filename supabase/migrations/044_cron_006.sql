-- 044_cron_006.sql
-- 006 — Deep Signal Capture
--   spec: specs/006-deep-signal-capture/spec.md
--   data: specs/006-deep-signal-capture/data-model.md
--
-- pg_cron schedules for 006 background work (biometric correlator,
-- signal purge, signal-audit pseudonymise, signal-audit integrity
-- check). Each schedule is wrapped in a DO block guarded by
-- `exception when duplicate_object` so re-applying the migration is a
-- no-op. Schedules that take an hour from an env-var-style setting
-- read it at scheduling time and interpolate it into the cron
-- expression string.

-- =============================================================================
-- 1. biometric-correlator
-- =============================================================================
-- Daily at app.biometric_correlator_cron_hour_utc (default 3). Fetches
-- Oura/Whoop daily summaries, hashes inputs, and writes to
-- biometric_aggregates and peak_window_inferences (FR-BIO-005).

do $$
declare
  v_hour text;
begin
  v_hour := coalesce(
    nullif(current_setting('app.biometric_correlator_cron_hour_utc', true), ''),
    '3'
  );
  perform cron.schedule(
    'biometric-correlator-daily',
    '0 ' || v_hour || ' * * *',
    $cron$ select net.http_post(
       url := current_setting('app.supabase_url', true) || '/functions/v1/biometric-correlator',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
       ),
       body := '{}'::jsonb
     ); $cron$
  );
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 2. signal-purge
-- =============================================================================
-- Daily at app.signal_purge_cron_hour_utc (default 4). Rolls up raw
-- rows into monthly summaries and enforces the retention windows
-- defined in FR-IDE-005 (30-day IDE) and FR-BIO-006 (90-day biometric).

do $$
declare
  v_hour text;
begin
  v_hour := coalesce(
    nullif(current_setting('app.signal_purge_cron_hour_utc', true), ''),
    '4'
  );
  perform cron.schedule(
    'signal-purge-daily',
    '0 ' || v_hour || ' * * *',
    $cron$ select net.http_post(
       url := current_setting('app.supabase_url', true) || '/functions/v1/signal-purge',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
       ),
       body := '{}'::jsonb
     ); $cron$
  );
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 3. signal-audit-pseudonymise
-- =============================================================================
-- Daily at 01:00 UTC. Replaces actor_id with a salted SHA-256 hash for
-- rows older than 90 days (FR-AUD-002). Salt is rotated yearly.

do $$
begin
  perform cron.schedule(
    'signal-audit-pseudonymise-daily',
    '0 1 * * *',
    $cron$ select net.http_post(
       url := current_setting('app.supabase_url', true) || '/functions/v1/signal-audit-pseudonymise',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
       ),
       body := '{}'::jsonb
     ); $cron$
  );
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 4. signal-audit-integrity-check
-- =============================================================================
-- Daily at 02:00 UTC. Asserts every signal_audit row has non-null
-- provider, byte_count, aggregate_hash (where applicable) and the
-- row-count delta matches the expected per-event count (FR-AUD-001,
-- SC-PRI-001). Failures page the on-call engineer.

do $$
begin
  perform cron.schedule(
    'signal-audit-integrity-check-daily',
    '0 2 * * *',
    $cron$ select net.http_post(
       url := current_setting('app.supabase_url', true) || '/functions/v1/signal-audit-integrity-check',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
       ),
       body := '{}'::jsonb
     ); $cron$
  );
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- End of 044_cron_006.sql
-- =============================================================================
