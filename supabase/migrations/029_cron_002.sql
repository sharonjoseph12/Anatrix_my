-- 029_cron_002.sql
-- T037, T051, T067 — pg_cron schedules for 002 background work.
-- The 001 base (012_cron_jobs.sql) already schedules `github-sync-2h` and
-- `calendar-sync-6h`. We don't re-schedule those here — they call the same
-- Edge Functions we extend. 002-specific jobs are listed below.

-- exam-week-detector: weekly Monday 02:00 UTC (after the 6h calendar-sync at 00:00)
select cron.unschedule('exam-week-detector-weekly') where exists (select 1 from cron.job where jobname = 'exam-week-detector-weekly');
select cron.schedule(
  'exam-week-detector-weekly', '0 2 * * 1',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/exam-week-detector',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);

-- T051 — nudge-trigger: hourly so per-user local-time decisions stay current
select cron.unschedule('nudge-trigger-hourly') where exists (select 1 from cron.job where jobname = 'nudge-trigger-hourly');
select cron.schedule(
  'nudge-trigger-hourly', '0 * * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/nudge-trigger',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := jsonb_build_object('mode', 'scheduled')
     ); $$
);

-- T063 — placement-predict: weekly Monday 03:00 UTC
select cron.unschedule('placement-predict-weekly') where exists (select 1 from cron.job where jobname = 'placement-predict-weekly');
select cron.schedule(
  'placement-predict-weekly', '0 3 * * 1',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/placement-predict',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);

-- T065 — credential-issue: daily 04:00 UTC
select cron.unschedule('credential-issue-daily') where exists (select 1 from cron.job where jobname = 'credential-issue-daily');
select cron.schedule(
  'credential-issue-daily', '0 4 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/credential-issue',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);
