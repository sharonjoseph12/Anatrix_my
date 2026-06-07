-- 013_cohort_functions.sql
-- Anonymous aggregate metrics for cohort comparison ("You vs Cohort").
-- Exposes only non-PII data: averages, percentiles, distributions.

-- =============================================================================
-- Cohort aggregate: median focus quality, median peak window start hour,
-- median overall score, top category mix, total members considered.
-- =============================================================================
create or replace function public.cohort_aggregate(p_cohort_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
  v_total int;
  v_avg_focus numeric;
  v_avg_score numeric;
  v_median_peak_hour numeric;
  v_median_score numeric;
  v_top_category text;
  v_total_sessions int;
  v_total_hours int;
  v_avg_hours_per_member numeric;
begin
  select count(*) into v_total
  from public.cohort_members cm
  where cm.cohort_id = p_cohort_id;

  if v_total = 0 then
    return jsonb_build_object(
      'member_count', 0,
      'avg_focus_quality', 0,
      'avg_overall_score', 0,
      'median_peak_hour', null,
      'median_overall_score', 0,
      'top_category', null,
      'total_sessions', 0,
      'total_hours', 0,
      'avg_hours_per_member', 0
    );
  end if;

  -- Average focus quality (0-1) and overall score across members
  select
    coalesce(avg(cp.avg_focus_quality), 0),
    coalesce(avg(cp.overall_skill_proof_score), 0)
  into v_avg_focus, v_avg_score
  from public.candidate_profiles cp
  join public.cohort_members cm on cm.user_id = cp.user_id
  where cm.cohort_id = p_cohort_id;

  -- Median overall score (percentile_disc)
  select coalesce(percentile_disc(0.5) within group (order by cp.overall_skill_proof_score), 0)
  into v_median_score
  from public.candidate_profiles cp
  join public.cohort_members cm on cm.user_id = cp.user_id
  where cm.cohort_id = p_cohort_id;

  -- Median peak window start hour (from peak_window jsonb)
  with hours as (
    select ((cp.peak_window ->> 'startHour')::int) as h
    from public.candidate_profiles cp
    join public.cohort_members cm on cm.user_id = cp.user_id
    where cm.cohort_id = p_cohort_id
      and cp.peak_window is not null
  )
  select percentile_disc(0.5) within group (order by h)
  into v_median_peak_hour
  from hours;

  -- Top category: most-common session.category across the cohort (last 30 days)
  with cat_counts as (
    select s.category, count(*) as n
    from public.sessions s
    join public.cohort_members cm on cm.user_id = s.user_id
    where cm.cohort_id = p_cohort_id
      and s.started_at >= now() - interval '30 days'
    group by s.category
  )
  select category into v_top_category
  from cat_counts
  order by n desc
  limit 1;

  select
    coalesce(count(s.id), 0),
    coalesce(sum(s.duration_minutes) / 60, 0)::int
  into v_total_sessions, v_total_hours
  from public.sessions s
  join public.cohort_members cm on cm.user_id = s.user_id
  where cm.cohort_id = p_cohort_id
    and s.started_at >= now() - interval '30 days';

  v_avg_hours_per_member := case when v_total > 0 then v_total_hours::numeric / v_total else 0 end;

  v_result := jsonb_build_object(
    'member_count', v_total,
    'avg_focus_quality', round(v_avg_focus::numeric, 2),
    'avg_overall_score', round(v_avg_score::numeric),
    'median_peak_hour', v_median_peak_hour,
    'median_overall_score', round(v_median_score::numeric),
    'top_category', v_top_category,
    'total_sessions', v_total_sessions,
    'total_hours', v_total_hours,
    'avg_hours_per_member', round(v_avg_hours_per_member, 1)
  );
  return v_result;
end $$;

-- =============================================================================
-- Cohort comparison for a specific user: their metrics vs the cohort aggregate.
-- Returns advantages: positive = user is ahead, negative = behind.
-- =============================================================================
create or replace function public.cohort_compare(p_user_id uuid, p_cohort_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_user record;
  v_agg jsonb;
  v_score_advantage int;
  v_focus_advantage numeric;
begin
  select
    overall_skill_proof_score,
    avg_focus_quality,
    (peak_window ->> 'startHour')::int as peak_start_hour
  into v_user
  from public.candidate_profiles
  where user_id = p_user_id;

  if v_user is null then
    return jsonb_build_object('error', 'no_profile');
  end if;

  v_agg := public.cohort_aggregate(p_cohort_id);

  v_score_advantage := coalesce(v_user.overall_skill_proof_score, 0)
                     - coalesce((v_agg ->> 'avg_overall_score')::int, 0);
  v_focus_advantage := round((coalesce(v_user.avg_focus_quality, 0)
                     - coalesce((v_agg ->> 'avg_focus_quality')::numeric, 0))::numeric, 2);

  return jsonb_build_object(
    'user', jsonb_build_object(
      'overall_score', v_user.overall_skill_proof_score,
      'avg_focus_quality', v_user.avg_focus_quality,
      'peak_start_hour', v_user.peak_start_hour
    ),
    'cohort', v_agg,
    'advantages', jsonb_build_object(
      'score', v_score_advantage,
      'focus', v_focus_advantage,
      'peak_alignment', case
        when v_user.peak_start_hour is null then null
        when (v_agg ->> 'median_peak_hour')::numeric is null then null
        else abs(v_user.peak_start_hour - (v_agg ->> 'median_peak_hour')::int)
      end
    )
  );
end $$;

comment on function public.cohort_aggregate is 'Anonymous aggregate metrics across a cohort (member count, averages, medians)';
comment on function public.cohort_compare    is 'Returns user metrics + cohort aggregate + computed advantages';
