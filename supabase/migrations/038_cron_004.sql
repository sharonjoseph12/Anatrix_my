-- 038_cron_004.sql
-- pg_cron schedules for 004 background work (anti-cheat, ATS, outcome
-- billing, next-best-skill, faculty outliers).
--
-- Convention lifted from 029_cron_002.sql: each schedule is unscheduled
-- and rescheduled in a guarded pair so re-apply is idempotent. Each
-- schedule calls the corresponding Supabase Edge Function via
-- `net.http_post`, with the function URL built from
-- `current_setting('app.functions_url')` — the same pattern used by
-- 012_cron_jobs.sql and 029_cron_002.sql.
--
-- The function URL fragment (e.g. `/github-anticheat`) is the deployed
-- Edge Function name. The body is the smallest JSON object that triggers
-- the function; most of these sweeps scan the database server-side and
-- don't need arguments.

-- github-anticheat: every 6 hours. The detector itself only emits signals
-- for rows whose last_checked_at is older than the staleness window, so
-- running on a 6h cadence gives each active student roughly daily coverage
-- while staying well below the 60 req/h Edge Function soft limit. Cheaper
-- than a per-student fan-out, equivalent in steady state.
select cron.unschedule('github-anticheat-6h')
  where exists (select 1 from cron.job where jobname = 'github-anticheat-6h');
select cron.schedule(
  'github-anticheat-6h', '0 */6 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/github-anticheat',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);

-- ats-sync-evaluator: every 5 minutes. Drives Greenhouse / Lever
-- saved-search evaluation. Short cadence keeps recruiter pipelines
-- feeling live; 5 min is the smallest interval pg_cron supports
-- cleanly across the rest of the schedule.
select cron.unschedule('ats-sync-evaluator-5m')
  where exists (select 1 from cron.job where jobname = 'ats-sync-evaluator-5m');
select cron.schedule(
  'ats-sync-evaluator-5m', '*/5 * * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/ats-sync-evaluator',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);

-- outcome-billing-finalizer: nightly 05:00 UTC. Walks
-- outcome_billing_events whose confirmed_at is older than the 30-day
-- dispute window and were not disputed, and marks the contract's
-- billing cycle as final. 05:00 UTC keeps it after credential-issue
-- (04:00) and before the next-best-skill sweep (06:00) so the day
-- runs in chronological order.
select cron.unschedule('outcome-billing-finalizer-nightly')
  where exists (select 1 from cron.job where jobname = 'outcome-billing-finalizer-nightly');
select cron.schedule(
  'outcome-billing-finalizer-nightly', '0 5 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/outcome-billing-finalizer',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := jsonb_build_object('disputeWindowDays', 30)
     ); $$
);

-- next-best-skill-sweep: every 24h at 06:00 UTC. Recomputes the
-- next_best_skills rows for all active students whose stack has
-- shifted materially. 24h is the documented D10 refresh cadence.
select cron.unschedule('next-best-skill-sweep-daily')
  where exists (select 1 from cron.job where jobname = 'next-best-skill-sweep-daily');
select cron.schedule(
  'next-best-skill-sweep-daily', '0 6 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/next-best-skill-sweep',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);

-- faculty-outlier-detect: nightly 07:00 UTC. Scans faculty_grades for
-- graders whose distribution deviates significantly from the
-- institution's median (lenient / harsh / random graders). Runs after
-- the billing finalizer and skill sweep so it has the freshest data.
select cron.unschedule('faculty-outlier-detect-nightly')
  where exists (select 1 from cron.job where jobname = 'faculty-outlier-detect-nightly');
select cron.schedule(
  'faculty-outlier-detect-nightly', '0 7 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/faculty-outlier-detect',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);
