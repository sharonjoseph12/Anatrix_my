-- 012_cron_jobs.sql
-- pg_cron schedules for background syncs and aggregate recalculations.
-- Requires the pg_cron and pg_net extensions (enabled in supabase/config.toml).
--
-- All calls use the service-role key to invoke edge functions via the
-- functions.invoke RPC (pg_net http_post) or by selecting from the
-- account tables directly with SECURITY DEFINER wrappers.
--
-- We use a SQL function per job so we can rerun/inspect them from the SQL editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- =============================================================================
-- github-sync: every 2 hours, for all active github accounts
-- =============================================================================
create or replace function public.cron_github_sync()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_url text;
  v_key text;
begin
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.supabase_service_role_key', true);
  if v_url is null or v_key is null then
    -- Fall back to env if settings not configured
    v_url := 'http://kong:8000';
    v_key := '';
  end if;

  for v_user_id in
    select user_id from public.github_accounts where status = 'active'
  loop
    perform
      net.http_post(
        url := v_url || '/functions/v1/github-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body := jsonb_build_object('user_id', v_user_id)
      );
  end loop;
end $$;

-- =============================================================================
-- calendar-sync: every 6 hours, for all active calendar accounts
-- =============================================================================
create or replace function public.cron_calendar_sync()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_url text;
  v_key text;
begin
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.supabase_service_role_key', true);
  if v_url is null or v_key is null then
    v_url := 'http://kong:8000';
    v_key := '';
  end if;

  for v_user_id in
    select user_id from public.calendar_accounts where status = 'active'
  loop
    perform
      net.http_post(
        url := v_url || '/functions/v1/calendar-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body := jsonb_build_object('user_id', v_user_id)
      );
  end loop;
end $$;

-- =============================================================================
-- Schedule entries
-- =============================================================================
-- Remove old jobs (idempotent re-runs)
select cron.unschedule('github-sync-2h')   where exists (select 1 from cron.job where jobname = 'github-sync-2h');
select cron.unschedule('calendar-sync-6h') where exists (select 1 from cron.job where jobname = 'calendar-sync-6h');

select cron.schedule(
  'github-sync-2h',
  '0 */2 * * *',
  $$ select public.cron_github_sync(); $$
);

select cron.schedule(
  'calendar-sync-6h',
  '0 */6 * * *',
  $$ select public.cron_calendar_sync(); $$
);

-- =============================================================================
-- rebuild_user_skills: returns the set of (skill_id, hours, score) for one user
-- Used by the update-profiles edge function to know which user_skill rows to
-- recompute. A skill is "in scope" if the user has ≥ 1 session in the last
-- 90 days for a project whose name (or repo language) maps to the skill.
-- =============================================================================
create or replace function public.rebuild_user_skills(p_user_id uuid)
returns table(skill_id uuid, hours_logged int, skill_proof_score int)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidate_skills as (
    select s.id as skill_id,
           coalesce(sum(sess.duration_minutes) / 60, 0)::int as hours_logged
    from public.skills s
    left join public.sessions sess
      on sess.user_id = p_user_id
     and sess.started_at >= now() - interval '90 days'
     and (
       sess.project_name ilike '%' || replace(s.slug, '-', '%') || '%'
       or sess.category::text = lower(s.category)
     )
    group by s.id
    having coalesce(sum(sess.duration_minutes), 0) > 0
  )
  select cs.skill_id, cs.hours_logged, 0::int
  from candidate_skills cs;
end $$;

-- =============================================================================
-- update-profiles: daily 03:00 UTC
-- =============================================================================
create or replace function public.cron_update_profiles()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_key text;
begin
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.supabase_service_role_key', true);
  if v_url is null or v_key is null then
    v_url := 'http://kong:8000';
    v_key := '';
  end if;

  perform
    net.http_post(
      url := v_url || '/functions/v1/update-profiles',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := '{}'::jsonb
    );
end $$;

select cron.unschedule('update-profiles-daily') where exists (select 1 from cron.job where jobname = 'update-profiles-daily');

select cron.schedule(
  'update-profiles-daily',
  '0 3 * * *',
  $$ select public.cron_update_profiles(); $$
);

comment on function public.rebuild_user_skills is 'Returns the set of skill_id + hours the user has activity for (last 90 days)';
comment on function public.cron_update_profiles  is 'pg_cron entry: invokes update-profiles edge function daily at 03:00 UTC';

comment on function public.cron_github_sync   is 'pg_cron entry: invokes github-sync edge function for every active user';
comment on function public.cron_calendar_sync is 'pg_cron entry: invokes calendar-sync edge function for every active user';

-- =============================================================================
-- generate-insights: weekly Monday 04:00 UTC
-- =============================================================================
create or replace function public.cron_generate_insights()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_key text;
begin
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.supabase_service_role_key', true);
  if v_url is null or v_key is null then
    v_url := 'http://kong:8000';
    v_key := '';
  end if;

  perform
    net.http_post(
      url := v_url || '/functions/v1/generate-insights',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := '{}'::jsonb
    );
end $$;

select cron.unschedule('generate-insights-weekly') where exists (select 1 from cron.job where jobname = 'generate-insights-weekly');

select cron.schedule(
  'generate-insights-weekly',
  '0 4 * * 1',
  $$ select public.cron_generate_insights(); $$
);

comment on function public.cron_generate_insights is 'pg_cron entry: invokes generate-insights edge function every Monday at 04:00 UTC';

-- =============================================================================
-- dsa-sync: every 6 hours (T018 / 003)
-- =============================================================================
create or replace function public.cron_dsa_sync()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_key text;
begin
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.supabase_service_role_key', true);
  if v_url is null or v_key is null then
    v_url := 'http://kong:8000';
    v_key := '';
  end if;

  perform
    net.http_post(
      url := v_url || '/functions/v1/dsa-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := '{"sweep": true}'::jsonb
    );
end $$;

select cron.unschedule('dsa-sync-6h') where exists (select 1 from cron.job where jobname = 'dsa-sync-6h');

select cron.schedule(
  'dsa-sync-6h',
  '0 */6 * * *',
  $$ select public.cron_dsa_sync(); $$
);

comment on function public.cron_dsa_sync is 'pg_cron entry: invokes dsa-sync edge function every 6 hours';

-- =============================================================================
-- nudge-dispatch-extended: every 30 min (T044 / 003)
-- Picks the right channel per user (in_app | telegram | discord | whatsapp)
-- and dispatches the row. Quiet hours + exam window both suppress.
-- =============================================================================
create or replace function public.cron_nudge_dispatch_extended()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_key text;
begin
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.supabase_service_role_key', true);
  if v_url is null or v_key is null then
    v_url := 'http://kong:8000';
    v_key := '';
  end if;

  perform
    net.http_post(
      url := v_url || '/functions/v1/nudge-dispatch-extended',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('limit', 200)
    );
end $$;

select cron.unschedule('nudge-dispatch-extended-30m') where exists (select 1 from cron.job where jobname = 'nudge-dispatch-extended-30m');

select cron.schedule(
  'nudge-dispatch-extended-30m',
  '*/30 * * * *',
  $$ select public.cron_nudge_dispatch_extended(); $$
);

comment on function public.cron_nudge_dispatch_extended is 'pg_cron entry: invokes nudge-dispatch-extended every 30 min (channel-aware dispatcher for 003)';
