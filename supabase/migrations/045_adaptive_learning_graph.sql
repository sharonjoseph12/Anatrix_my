-- 045_adaptive_learning_graph.sql

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. alumni_profiles
create table public.alumni_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  opted_in_for_mentorship boolean not null default false,
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  target_company_tags text[] not null default '{}',
  specialty_tags text[] not null default '{}',
  lesson_progression_topics text[] not null default '{}',
  rating_avg numeric(3,2) check (rating_avg between 0 and 5),
  rating_count int not null default 0 check (rating_count >= 0),
  sessions_count int not null default 0 check (sessions_count >= 0),
  no_show_count int not null default 0 check (no_show_count >= 0),
  public_profile_visible boolean not null default true,
  employer text,
  role text,
  bio text check (char_length(bio) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_alumni_profiles_opt_in on public.alumni_profiles (opted_in_for_mentorship, opted_out) where opted_in_for_mentorship = true and opted_out = false;
create index idx_alumni_profiles_rating on public.alumni_profiles (rating_avg desc) where rating_count >= 3;

alter table public.alumni_profiles enable row level security;
create policy select_alumni_profiles_students on public.alumni_profiles for select using (public_profile_visible = true AND opted_out = false);
create policy all_alumni_profiles_owner on public.alumni_profiles for all using (auth.uid() = user_id);

-- 2. mentor_availability_slots
create table public.mentor_availability_slots (
  id uuid primary key default gen_random_uuid(),
  alumnus_id uuid not null references public.users(id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  recurrence_rule text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint check_slot_order check (slot_end > slot_start)
);

create index idx_mentor_slots_alumnus on public.mentor_availability_slots (alumnus_id, slot_start) where is_blocked = false;
create index idx_mentor_slots_start on public.mentor_availability_slots (slot_start) where is_blocked = false;

alter table public.mentor_availability_slots enable row level security;
create policy all_mentor_slots_owner on public.mentor_availability_slots for all using (auth.uid() = alumnus_id);
create policy select_mentor_slots_students on public.mentor_availability_slots for select using (
  exists (
    select 1 from public.alumni_profiles 
    where user_id = mentor_availability_slots.alumnus_id 
    and public_profile_visible = true 
    and opted_out = false
  )
);

-- 3. mentor_requests
create table public.mentor_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  alumnus_id uuid not null references public.users(id) on delete cascade,
  slot_id uuid not null references public.mentor_availability_slots(id) on delete restrict,
  intro_text text not null check (char_length(intro_text) between 1 and 200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index idx_mentor_requests_slot_unique on public.mentor_requests (slot_id) where status in ('pending', 'accepted');
create index idx_mentor_requests_student on public.mentor_requests (student_id, created_at desc);
create index idx_mentor_requests_alumnus on public.mentor_requests (alumnus_id, status) where status = 'pending';

alter table public.mentor_requests enable row level security;
create policy all_mentor_requests_student on public.mentor_requests for all using (auth.uid() = student_id);
create policy select_update_mentor_requests_alumnus on public.mentor_requests for all using (auth.uid() = alumnus_id);

-- 4. mentor_sessions
create table public.mentor_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.mentor_requests(id),
  student_id uuid not null references public.users(id),
  alumnus_id uuid not null references public.users(id),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  video_room_url text,
  video_provider text check (video_provider in ('livekit', 'google_meet')),
  status text not null default 'scheduled' check (status in ('scheduled', 'joined', 'completed', 'no_show', 'cancelled')),
  joined_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint check_session_order check (scheduled_end > scheduled_start)
);

create index idx_mentor_sessions_student on public.mentor_sessions (student_id, scheduled_start desc);
create index idx_mentor_sessions_alumnus on public.mentor_sessions (alumnus_id, scheduled_start desc);
create index idx_mentor_sessions_needs_feedback on public.mentor_sessions (scheduled_end) where status = 'scheduled';

alter table public.mentor_sessions enable row level security;
create policy select_mentor_sessions_student on public.mentor_sessions for select using (auth.uid() = student_id);
create policy select_mentor_sessions_alumnus on public.mentor_sessions for select using (auth.uid() = alumnus_id);

-- 5. mentor_feedback
create table public.mentor_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mentor_sessions(id) on delete cascade,
  submitter_id uuid not null references public.users(id),
  subject_id uuid not null references public.users(id),
  rating int check (rating between 1 and 5),
  feedback_text text check (char_length(feedback_text) <= 500),
  no_show_flag boolean not null default false,
  created_at timestamptz not null default now(),
  constraint unique_feedback_per_submitter unique (session_id, submitter_id),
  constraint diff_users check (submitter_id <> subject_id),
  constraint rating_or_noshow check (rating is not null or no_show_flag = true)
);

create index idx_mentor_feedback_subject on public.mentor_feedback (subject_id, created_at desc);
create index idx_mentor_feedback_session on public.mentor_feedback (session_id);

alter table public.mentor_feedback enable row level security;
create policy all_mentor_feedback_submitter on public.mentor_feedback for all using (auth.uid() = submitter_id);
create policy select_mentor_feedback_subject on public.mentor_feedback for select using (auth.uid() = subject_id);

-- 6. skill_trajectory_embeddings
create table public.skill_trajectory_embeddings (
  user_id uuid primary key references public.users(id) on delete cascade,
  embedding vector(384) not null,
  event_count int not null check (event_count >= 0),
  last_computed_at timestamptz not null default now(),
  model_version text not null default 'all-MiniLM-L6-v2@2024'
);

CREATE INDEX skill_trajectory_embeddings_embedding_hnsw_idx
  ON public.skill_trajectory_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

alter table public.skill_trajectory_embeddings enable row level security;
create policy select_embeddings_self on public.skill_trajectory_embeddings for select using (auth.uid() = user_id);

-- 7. curriculum_lessons
create table public.curriculum_lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  concept text not null,
  exercise_starter_code text not null,
  reflection_question text not null check (char_length(reflection_question) <= 200),
  alumnus_project_link text not null check (char_length(alumnus_project_link) > 0),
  duration_minutes int not null check (duration_minutes between 10 and 15),
  scheduled_window_start timestamptz not null,
  scheduled_window_end timestamptz not null,
  recommender_debug jsonb not null default '{}',
  created_for_date date not null,
  created_at timestamptz not null default now(),
  constraint check_lesson_window check (scheduled_window_end > scheduled_window_start)
);

create index idx_curriculum_lessons_student_date on public.curriculum_lessons (student_id, created_for_date);
create index idx_curriculum_lessons_student_topic on public.curriculum_lessons (student_id, topic, created_for_date desc);
create index if not exists idx_curriculum_lessons_date
  on public.curriculum_lessons (created_for_date);

alter table public.curriculum_lessons enable row level security;
create policy all_curriculum_lessons_student on public.curriculum_lessons for all using (auth.uid() = student_id);

-- 8. lesson_feedback
create table public.lesson_feedback (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.curriculum_lessons(id) on delete cascade,
  student_id uuid not null references public.users(id),
  feedback_kind text not null check (feedback_kind in ('too_easy', 'too_hard', 'irrelevant', 'completed')),
  feedback_text text check (char_length(feedback_text) <= 280),
  created_at timestamptz not null default now(),
  constraint unique_lesson_feedback unique (lesson_id, student_id, feedback_kind)
);

create index idx_lesson_feedback_student on public.lesson_feedback (student_id, created_at desc);
create index idx_lesson_feedback_lesson on public.lesson_feedback (lesson_id, feedback_kind);
create index idx_lesson_feedback_struggle on public.lesson_feedback (created_at) where feedback_kind in ('too_hard', 'irrelevant');

alter table public.lesson_feedback enable row level security;
create policy all_lesson_feedback_student on public.lesson_feedback for all using (auth.uid() = student_id);

-- 9. curriculum_cost_counters
create table public.curriculum_cost_counters (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('student', 'tenant')),
  scope_id uuid not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  tokens_used int not null default 0 check (tokens_used >= 0),
  lessons_generated int not null default 0 check (lessons_generated >= 0),
  cap_tokens int not null check (cap_tokens > 0),
  breach_log jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_cost_counter unique (scope, scope_id, window_start)
);

create index idx_cost_counters_scope on public.curriculum_cost_counters (scope, scope_id, window_start desc);
create index idx_cost_counters_tenant on public.curriculum_cost_counters (window_start) where scope = 'tenant';

alter table public.curriculum_cost_counters enable row level security;
-- service role only

-- 10. mentor_suggestions
create table public.mentor_suggestions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  suggested_alumni_ids uuid[] not null check (array_length(suggested_alumni_ids, 1) <= 5),
  triggered_at timestamptz not null default now(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  consumed_at timestamptz,
  constraint unique_mentor_suggestion unique (student_id, topic, window_start),
  constraint check_suggestion_window check (window_end > window_start)
);

create index idx_mentor_suggestions_student on public.mentor_suggestions (student_id, consumed_at);
create index idx_mentor_suggestions_unconsumed on public.mentor_suggestions (triggered_at) where consumed_at is null;

alter table public.mentor_suggestions enable row level security;
create policy all_mentor_suggestions_student on public.mentor_suggestions for all using (auth.uid() = student_id);
