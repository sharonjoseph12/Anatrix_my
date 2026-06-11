-- 021_predictions.sql
-- T014 — placement_predictions, exam_windows

create type company_tier as enum ('tier_1', 'tier_2', 'tier_3');

create table if not exists public.placement_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  run_week date not null,
  probability_0_100 int not null check (probability_0_100 between 0 and 100),
  company_tier company_tier not null,
  time_to_ready_months numeric(3, 1),
  top_gaps jsonb,
  input_features jsonb,
  model_version varchar(32) not null,
  computed_at timestamptz not null default now(),
  unique (user_id, run_week)
);
create index if not exists placement_predictions_user_computed_idx
  on public.placement_predictions(user_id, computed_at desc);

create type exam_window_basis as enum ('keyword_density', 'all_day_blocks', 'manual_flag');

create table if not exists public.exam_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  detection_basis exam_window_basis not null,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (user_id, start_date, end_date)
);
create index if not exists exam_windows_user_idx on public.exam_windows(user_id, start_date);
