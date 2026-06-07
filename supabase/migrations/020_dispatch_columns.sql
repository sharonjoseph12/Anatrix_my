-- supabase/migrations/020_dispatch_columns.sql
-- T043 + T052 — Extend `notifications` to track channel dispatch, and add a
-- minimal `exams` table for exam-window suppression in the channel resolver.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_channel TEXT
    CHECK (dispatched_channel IN ('in_app','telegram','discord','whatsapp','email','push')),
  ADD COLUMN IF NOT EXISTS dispatched_status TEXT
    CHECK (dispatched_status IN ('sent','failed','skipped'));

CREATE INDEX IF NOT EXISTS notifications_pending_idx
  ON public.notifications (created_at)
  WHERE dispatched_at IS NULL;

-- Quiet-hours support: per-user exam windows block all nudges.
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS exams_window_idx
  ON public.exams (user_id, starts_at, ends_at);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exams self" ON public.exams;
CREATE POLICY "exams self" ON public.exams
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
