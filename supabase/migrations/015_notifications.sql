-- supabase/migrations/015_notifications.sql
-- T092 — Realtime-driven in-app notifications. Backed by Supabase Realtime
-- postgres_changes inserts on `public.notifications` filtered by user_id.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in (
    'insight_ready',
    'company_interest',
    'interview_scheduled',
    'hiring_outcome',
    'cohort_invite',
    'system'
  )),
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id);

-- Inserts happen via service role (server actions) so we don't expose
-- an INSERT policy to authenticated users. Realtime broadcast picks up
-- service-role inserts automatically.
alter publication supabase_realtime add table public.notifications;
