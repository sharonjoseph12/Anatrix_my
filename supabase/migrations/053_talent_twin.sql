-- 053_talent_twin.sql
-- 010 -- AI Talent Twin
--   spec: specs/010-ai-talent-twin/spec.md
--   data: specs/010-ai-talent-twin/data-model.md
--
-- Seven new tables, one users column extension, GIN indexes on
-- existing source tables, three helper functions, and RLS policies.
-- Every DDL is wrapped in IF NOT EXISTS / exception guards.

-- =============================================================================
-- 1. talent_twin_chunks
-- =============================================================================
-- Stores per-student work chunks with pgvector embeddings for RAG
-- similarity search. No SELECT RLS -- service-role only reads.
-- Students can DELETE their own chunks (opt-out).

create table if not exists public.talent_twin_chunks (
  id              uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references public.users(id) on delete cascade,
  chunk_type      text    not null check (chunk_type in ('code','commit','ide_session','collab','mock_interview','faculty_grade','dsa_chat','curriculum','badge')),
  source_id       text    not null,
  source_url      text,
  title           text,
  content         text    not null,
  embedding       vector(384) not null,
  metadata        jsonb   not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_twin_chunks_user_type
  on public.talent_twin_chunks using btree (user_id, chunk_type);

create index if not exists idx_twin_chunks_embedding
  on public.talent_twin_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 200);

alter table public.talent_twin_chunks enable row level security;

create policy "students can delete own chunks"
  on public.talent_twin_chunks for delete
  using (auth.uid() = user_id);

-- No SELECT policy: service-role reads only. This is intentional
-- privacy design -- chunks are never returned directly to any user.

-- =============================================================================
-- 2. talent_twin_qa_log
-- =============================================================================
-- Append-only audit log for every recruiter Q&A interaction. Only
-- hashes are stored -- never raw question/answer text.

create table if not exists public.talent_twin_qa_log (
  id              bigserial   primary key,
  student_id      uuid        not null references public.users(id) on delete cascade,
  recruiter_id    uuid        not null references public.users(id),
  chat_session_id uuid        references public.recruiter_chat_session(id),
  question_hash   text        not null,
  answer_hash     text        not null,
  citation_links  jsonb       not null default '[]'::jsonb,
  status          text        not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  latency_ms      int,
  created_at      timestamptz not null default now()
);

create index if not exists idx_qa_log_student_created
  on public.talent_twin_qa_log using btree (student_id, created_at desc);

create index if not exists idx_qa_log_recruiter_created
  on public.talent_twin_qa_log using btree (recruiter_id, created_at desc);

create index if not exists idx_qa_log_question_student
  on public.talent_twin_qa_log using btree (question_hash, student_id);

alter table public.talent_twin_qa_log enable row level security;

create policy "students see own qa log"
  on public.talent_twin_qa_log for select
  using (auth.uid() = student_id);

create policy "recruiters see own approved qa log"
  on public.talent_twin_qa_log for select
  using (auth.uid() = recruiter_id and status = 'approved');

-- =============================================================================
-- 3. answer_preview
-- =============================================================================
-- Ephemeral table holding pending answers for student preview.
-- Auto-purged on approve/reject. Raw question text stored
-- temporarily; deleted on action.

create table if not exists public.answer_preview (
  id                uuid        primary key default gen_random_uuid(),
  student_id        uuid        not null references public.users(id) on delete cascade,
  recruiter_id      uuid        not null references public.users(id),
  chat_session_id   uuid        references public.recruiter_chat_session(id),
  recruiter_question text       not null,
  llm_answer        text        not null,
  edited_answer     text,
  citation_links    jsonb       not null default '[]'::jsonb,
  status            text        not null default 'pending' check (status in ('pending','approved','rejected')),
  auto_approve_at   timestamptz not null default now() + interval '24 hours',
  created_at        timestamptz not null default now(),
  approved_at       timestamptz,
  rejected_at       timestamptz
);

create index if not exists idx_answer_preview_student_status
  on public.answer_preview using btree (student_id, status, created_at desc);

create index if not exists idx_answer_preview_auto_approve
  on public.answer_preview using btree (auto_approve_at);

alter table public.answer_preview enable row level security;

create policy "students see own pending answers"
  on public.answer_preview for select
  using (auth.uid() = student_id);

create policy "recruiters see approved answers for opted-in students"
  on public.answer_preview for select
  using (auth.uid() = recruiter_id and status = 'approved');

-- =============================================================================
-- 4. recruiter_chat_session
-- =============================================================================
-- Tracks chat session boundaries for UI pagination and abuse detection.

create table if not exists public.recruiter_chat_session (
  id                uuid        primary key default gen_random_uuid(),
  recruiter_id      uuid        not null references public.users(id),
  student_id        uuid        not null references public.users(id),
  started_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  question_count    int         not null default 0 check (question_count >= 0),
  ended_at          timestamptz
);

create index if not exists idx_chat_session_recruiter_student
  on public.recruiter_chat_session using btree (recruiter_id, student_id, started_at desc);

create index if not exists idx_chat_session_last_activity
  on public.recruiter_chat_session using btree (last_activity_at);

alter table public.recruiter_chat_session enable row level security;

create policy "recruiters see own sessions"
  on public.recruiter_chat_session for select
  using (auth.uid() = recruiter_id);

create policy "students see sessions where they are subject"
  on public.recruiter_chat_session for select
  using (auth.uid() = student_id);

-- =============================================================================
-- 5. badge_revocations
-- =============================================================================
-- Tracks revoked authorship badges. Public SELECT for verification.

create table if not exists public.badge_revocations (
  id          uuid        primary key default gen_random_uuid(),
  badge_nonce uuid        not null unique,
  badge_id    uuid        not null,
  reason      text,
  revoked_by  uuid        not null references public.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_badge_revocations_nonce
  on public.badge_revocations using btree (badge_nonce);

create index if not exists idx_badge_revocations_badge_id
  on public.badge_revocations using btree (badge_id);

alter table public.badge_revocations enable row level security;

create policy "anyone can verify badge revocation"
  on public.badge_revocations for select
  using (true);

-- =============================================================================
-- 6. authorship_proof
-- =============================================================================
-- Lifecycle tracking for authorship proof requests.

create table if not exists public.authorship_proof (
  id                      uuid        primary key default gen_random_uuid(),
  student_id              uuid        not null references public.users(id) on delete cascade,
  project_id              uuid        not null,
  session_vector          jsonb,
  baseline_similarity     numeric(4,3) check (baseline_similarity >= 0 and baseline_similarity <= 1),
  confidence_score        int         check (confidence_score >= 0 and confidence_score <= 100),
  verifiable_credential_url text,
  status                  text        not null default 'requested' check (status in ('requested','completed','failed','revoked')),
  created_at              timestamptz not null default now(),
  completed_at            timestamptz
);

create index if not exists idx_authorship_proof_student
  on public.authorship_proof using btree (student_id, created_at desc);

create index if not exists idx_authorship_proof_project
  on public.authorship_proof using btree (project_id);

alter table public.authorship_proof enable row level security;

create policy "students see own proofs"
  on public.authorship_proof for select
  using (auth.uid() = student_id);

create policy "employers see completed proofs for visible projects"
  on public.authorship_proof for select
  using (status = 'completed');

-- =============================================================================
-- 7. authorship_sandbox_sessions
-- =============================================================================
-- Per-session capture data for sandboxed writing sessions.

create table if not exists public.authorship_sandbox_sessions (
  id                      uuid        primary key default gen_random_uuid(),
  proof_id                uuid        not null references public.authorship_proof(id) on delete cascade,
  keystroke_timing_vector jsonb       not null,
  ast_diff_sequence       jsonb       not null,
  error_recovery_vector   jsonb       not null,
  duration_seconds        int         not null check (duration_seconds >= 30),
  created_at              timestamptz not null default now()
);

create index if not exists idx_sandbox_sessions_proof
  on public.authorship_sandbox_sessions using btree (proof_id);

alter table public.authorship_sandbox_sessions enable row level security;

create policy "students see own session data"
  on public.authorship_sandbox_sessions for select
  using (
    exists (
      select 1 from public.authorship_proof
      where authorship_proof.id = proof_id
        and authorship_proof.student_id = auth.uid()
    )
  );

-- =============================================================================
-- 8. users column extension
-- =============================================================================

alter table public.users
  add column if not exists talent_twin_opt_in boolean not null default false;

create index if not exists idx_users_twin_opt_in
  on public.users using btree (talent_twin_opt_in)
  where talent_twin_opt_in = true;

-- =============================================================================
-- 9. GIN indexes on existing source tables
-- =============================================================================
-- Enable fast per-student + per-source-type filtering during chunking.

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'github_commits') then
    create index if not exists idx_github_commits_student_source on public.github_commits using gin (student_id, source_type);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'pull_requests') then
    create index if not exists idx_pull_requests_student_source on public.pull_requests using gin (student_id, source_type);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'dsa_coach_chat_logs') then
    create index if not exists idx_dsa_chat_student_source on public.dsa_coach_chat_logs using gin (student_id, source_type);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'mock_interview_transcripts') then
    create index if not exists idx_mock_interview_student_source on public.mock_interview_transcripts using gin (student_id, source_type);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'faculty_grade_comments') then
    create index if not exists idx_faculty_grade_comments_student_source on public.faculty_grade_comments using gin (student_id, source_type);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ide_sessions') then
    create index if not exists idx_ide_sessions_student_source on public.ide_sessions using gin (student_id, source_type);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'lesson_feedback') then
    create index if not exists idx_lesson_feedback_student_source on public.lesson_feedback using gin (student_id, source_type);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'collab_artifacts') then
    create index if not exists idx_collab_artifacts_student_source on public.collab_artifacts using gin (student_id, source_type);
  end if;
end;
$$ language plpgsql;

-- =============================================================================
-- 10. SQL functions
-- =============================================================================

create or replace function public.delete_student_chunks(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.talent_twin_chunks where user_id = p_user_id;
end;
$$;

create or replace function public.insert_twin_chunk(
  p_user_id uuid,
  p_chunk_type text,
  p_source_id text,
  p_source_url text default null,
  p_title text default null,
  p_content text,
  p_embedding vector(384),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.talent_twin_chunks (user_id, chunk_type, source_id, source_url, title, content, embedding, metadata)
  values (p_user_id, p_chunk_type, p_source_id, p_source_url, p_title, p_content, p_embedding, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.search_twin_chunks(
  p_user_ids uuid[],
  p_query_embedding vector(384),
  p_limit int default 10
)
returns table (
  id uuid,
  user_id uuid,
  chunk_type text,
  source_url text,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  select
    tc.id,
    tc.user_id,
    tc.chunk_type,
    tc.source_url,
    tc.title,
    tc.content,
    tc.metadata,
    1 - (tc.embedding <=> p_query_embedding) as similarity
  from public.talent_twin_chunks tc
  where tc.user_id = any(p_user_ids)
  order by tc.embedding <=> p_query_embedding
  limit p_limit;
end;
$$;
