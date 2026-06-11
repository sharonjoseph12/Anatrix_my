-- 030_nudge_events.sql
-- T046 + T052 — system-wide nudge event helper and a Power-Mode session trigger

-- The single entry point the rest of the system calls to enqueue an
-- event-driven nudge (real-time peak, streak-risk, verification invite, etc.).
-- The actual decision of whether to send is made in the Edge Function
-- (which uses shouldSuppress to respect prefs/quiet hours/exam windows).
create or replace function public.trigger_nudge_event(
  p_user_id uuid,
  p_event_type text,
  p_context jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert a pending nudge row of type 'event' which nudge-dispatch consumes.
  -- The Edge Function picks it up via a webhook subscription (not a queue table)
  -- and applies shouldSuppress + peak-window checks before delivery.
  perform net.http_post(
    url := current_setting('app.functions_url') || '/nudge-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'event_type', p_event_type,
      'context', p_context
    )
  );
end;
$$;

-- T052 — when a Power-Mode session starts, fire a real-time-peak nudge event
-- so the AI Coach can prompt the student (peak_session_started).
create or replace function public.sessions_after_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.extension_version is not null then
    -- Power Mode session: notify the in-progress peak pattern
    perform public.trigger_nudge_event(
      new.user_id,
      'peak_session_started',
      jsonb_build_object(
        'session_id', new.id,
        'start_at', new.started_at,
        'category', new.category
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sessions_nudge_event on public.sessions;
create trigger trg_sessions_nudge_event
  after insert on public.sessions
  for each row
  execute function public.sessions_after_insert();
