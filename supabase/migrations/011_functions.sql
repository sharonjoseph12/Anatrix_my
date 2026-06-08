-- 011_functions.sql
-- Server-side calculation functions for skill scoring and profile aggregation

-- =============================================================================
-- Skill proof score calculation
-- Weighted: hours (25%), projects (35%), quality (25%), consistency (15%)
-- Returns 0-100
-- =============================================================================
create or replace function public.calculate_skill_proof_score(
  p_hours_logged int,
  p_projects_completed int,
  p_avg_completion_rate numeric,
  p_avg_focus_quality numeric,
  p_hours_score numeric,
  p_projects_score numeric,
  p_quality_score numeric,
  p_consistency_score numeric
) returns int
language plpgsql immutable as $$
declare
  v_score numeric;
begin
  v_score := (coalesce(p_hours_score, 0) * 0.25
            + coalesce(p_projects_score, 0) * 0.35
            + coalesce(p_quality_score, 0) * 0.25
            + coalesce(p_consistency_score, 0) * 0.15)::numeric;
  return greatest(0, least(100, round(v_score)::int));
end $$;

-- =============================================================================
-- Proficiency level from score
-- =============================================================================
create or replace function public.score_to_proficiency(p_score int)
returns proficiency_level
language plpgsql immutable as $$
begin
  if p_score >= 90 then return 'expert'::proficiency_level;
  elsif p_score >= 75 then return 'advanced'::proficiency_level;
  elsif p_score >= 55 then return 'proficient'::proficiency_level;
  elsif p_score >= 30 then return 'developing'::proficiency_level;
  else return 'novice'::proficiency_level;
  end if;
end $$;

-- =============================================================================
-- Recalculate a single user_skill row from raw inputs
-- Called by update-profiles edge function
-- =============================================================================
create or replace function public.recalculate_user_skill(
  p_user_id uuid,
  p_skill_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_skill skills;
  v_hours int;
  v_projects int;
  v_completion numeric;
  v_focus numeric;
  v_hours_score numeric;
  v_projects_score numeric;
  v_quality_score numeric;
  v_consistency_score numeric;
  v_score int;
  v_proficiency proficiency_level;
  v_last_project date;
begin
  select * into v_skill from public.skills where id = p_skill_id;
  if v_skill.id is null then return; end if;

  -- Aggregate from sessions in the last 90 days
  select
    coalesce(sum(s.duration_minutes) / 60, 0)::int,
    count(distinct s.project_name) filter (where s.project_name is not null),
    coalesce(avg(case when s.ended_at is not null then 1.0 else 0.0 end), 0),
    coalesce(avg(coalesce(s.focus_score,
      case s.focus_level
        when 'high' then 0.9
        when 'medium' then 0.6
        else 0.3
      end)), 0),
    max(s.started_at)::date
  into v_hours, v_projects, v_completion, v_focus, v_last_project
  from public.sessions s
  where s.user_id = p_user_id
    and s.started_at >= now() - interval '90 days';

  -- Component scores (0-100)
  v_hours_score := least(100, (v_hours::numeric / nullif(v_skill.avg_hours_to_proficiency, 0)) * 100);
  v_projects_score := least(100, v_projects * 25); -- 4 projects = full marks
  v_quality_score := round(((v_completion + v_focus) / 2) * 100);
  v_consistency_score := least(100, v_hours / 4); -- 4h/week baseline

  v_score := public.calculate_skill_proof_score(
    v_hours, v_projects, v_completion, v_focus,
    v_hours_score, v_projects_score, v_quality_score, v_consistency_score
  );
  v_proficiency := public.score_to_proficiency(v_score);

  insert into public.user_skills (
    user_id, skill_id,
    hours_logged, projects_completed,
    avg_completion_rate, avg_focus_quality,
    hours_score, projects_score, quality_score, consistency_score,
    skill_proof_score, proficiency_level,
    last_project_date, last_calculated_at
  )
  values (
    p_user_id, p_skill_id,
    v_hours, v_projects,
    v_completion, v_focus,
    v_hours_score, v_projects_score, v_quality_score, v_consistency_score,
    v_score, v_proficiency,
    v_last_project, now()
  )
  on conflict (user_id, skill_id) do update set
    hours_logged = excluded.hours_logged,
    projects_completed = excluded.projects_completed,
    avg_completion_rate = excluded.avg_completion_rate,
    avg_focus_quality = excluded.avg_focus_quality,
    hours_score = excluded.hours_score,
    projects_score = excluded.projects_score,
    quality_score = excluded.quality_score,
    consistency_score = excluded.consistency_score,
    skill_proof_score = excluded.skill_proof_score,
    proficiency_level = excluded.proficiency_level,
    last_project_date = excluded.last_project_date,
    last_calculated_at = excluded.last_calculated_at;
end $$;

-- =============================================================================
-- Aggregate candidate_profiles for one user
-- Called by update-profiles edge function
-- =============================================================================
create or replace function public.recalculate_candidate_profile(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_top_skills jsonb;
  v_overall_score int;
  v_specialization text;
  v_total_hours int;
  v_total_projects int;
  v_total_sessions int;
  v_total_commits int;
  v_avg_completion numeric;
  v_avg_focus numeric;
  v_institution uuid;
  v_peak_window jsonb;
  v_placement_ready boolean;
begin
  -- Top skills by score
  select coalesce(jsonb_agg(s.name order by us.skill_proof_score desc), '[]'::jsonb)
    into v_top_skills
  from public.user_skills us
  join public.skills s on s.id = us.skill_id
  where us.user_id = p_user_id;

  -- Overall score = weighted top 3 + breadth bonus
  with top3 as (
    select skill_proof_score
    from public.user_skills
    where user_id = p_user_id
    order by skill_proof_score desc
    limit 3
  )
  select
    case
      when count(*) = 0 then 0
      else round(
        (coalesce(avg(skill_proof_score), 0) * 0.7)
        + (case when count(*) >= 5 then 10 else 0 end)
        + (case when max(skill_proof_score) >= 85 then 5 else 0 end)
      )::int
    end
  into v_overall_score
  from top3;

  v_specialization := (v_top_skills ->> 0);

  select
    coalesce(sum(hours_logged), 0)::int,
    coalesce(sum(projects_completed), 0)::int
  into v_total_hours, v_total_projects
  from public.user_skills
  where user_id = p_user_id;

  select count(*) into v_total_sessions
  from public.sessions
  where user_id = p_user_id
    and started_at >= now() - interval '90 days';

  select count(*) into v_total_commits
  from public.github_activity
  where user_id = p_user_id
    and committed_at >= now() - interval '90 days';

  select
    coalesce(avg(avg_completion_rate), 0),
    coalesce(avg(avg_focus_quality), 0)
  into v_avg_completion, v_avg_focus
  from public.user_skills
  where user_id = p_user_id;

  select institution_id into v_institution
  from public.institution_members
  where user_id = p_user_id
  order by joined_at asc
  limit 1;

  v_placement_ready := (v_overall_score >= 80) and (v_total_hours >= 200);

  insert into public.candidate_profiles (
    user_id, institution_id,
    overall_skill_proof_score, primary_specialization, specialization_scores,
    total_hours_logged, total_projects_completed, total_sessions, total_commits,
    avg_project_completion_rate, avg_focus_quality,
    placement_ready, last_updated_at
  )
  values (
    p_user_id, v_institution,
    v_overall_score, v_specialization, v_top_skills,
    v_total_hours, v_total_projects, v_total_sessions, v_total_commits,
    v_avg_completion, v_avg_focus,
    v_placement_ready, now()
  )
  on conflict (user_id) do update set
    institution_id = excluded.institution_id,
    overall_skill_proof_score = excluded.overall_skill_proof_score,
    primary_specialization = excluded.primary_specialization,
    specialization_scores = excluded.specialization_scores,
    total_hours_logged = excluded.total_hours_logged,
    total_projects_completed = excluded.total_projects_completed,
    total_sessions = excluded.total_sessions,
    total_commits = excluded.total_commits,
    avg_project_completion_rate = excluded.avg_project_completion_rate,
    avg_focus_quality = excluded.avg_focus_quality,
    placement_ready = excluded.placement_ready,
    last_updated_at = excluded.last_updated_at;
end $$;

-- =============================================================================
-- Ensure user_skills rows exist for top skills (idempotent bootstrap)
-- =============================================================================
create or replace function public.ensure_user_skill_row(
  p_user_id uuid,
  p_skill_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_skills (user_id, skill_id, skill_proof_score, proficiency_level)
  values (p_user_id, p_skill_id, 0, 'novice'::proficiency_level)
  on conflict (user_id, skill_id) do nothing;
end $$;

comment on function public.calculate_skill_proof_score is 'Weighted composite: hours 25% + projects 35% + quality 25% + consistency 15%';
comment on function public.score_to_proficiency is 'Map 0-100 score to proficiency tier';
comment on function public.recalculate_user_skill is 'Recompute user_skills row from last 90 days of sessions';
comment on function public.recalculate_candidate_profile is 'Recompute candidate_profiles row from user_skills + activity';
