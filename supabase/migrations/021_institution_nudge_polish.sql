-- supabase/migrations/021_institution_nudge_polish.sql
-- T048 — Make institution_nudge_settings include the `enabled` boolean
-- (defaulted true on insert from /api/institution-nudges), an `enabled` column
-- for soft-disable, and a `set_by_user_id` audit column.

ALTER TABLE public.institution_nudge_settings
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS set_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
