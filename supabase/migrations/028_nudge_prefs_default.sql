-- 028_nudge_prefs_default.sql
-- T033 (standalone-file version) — alternative to the T019-folded trigger for teams that prefer one trigger per file
-- This file is OPTIONAL when running 026_user_deltas.sql; the trigger in 026 covers the same behavior.
-- Apply only if you skipped the trg_users_create_nudge_prefs trigger in 023.

create or replace function public.handle_new_user_create_nudge_prefs_standalone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.nudge_preferences (user_id, timezone)
  values (new.id, 'Asia/Kolkata')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_users_create_nudge_prefs_standalone on public.users;
create trigger trg_users_create_nudge_prefs_standalone
  after insert on public.users
  for each row execute function public.handle_new_user_create_nudge_prefs_standalone();
