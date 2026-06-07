-- supabase/migrations/018_external_channels.sql
-- T007 — External channel handles (Discord / Telegram / WhatsApp) and
-- institution-paid channel enablement.

create table if not exists public.external_channel_handles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('discord', 'telegram', 'whatsapp')),
  handle text not null,
  platform_id text,
  verified_at timestamptz,
  disconnected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel)
);

create index if not exists idx_external_channels_user_channel
  on public.external_channel_handles (user_id, channel);

create index if not exists idx_external_channels_verified
  on public.external_channel_handles (user_id)
  where verified_at is not null and disconnected_reason is null;

alter table public.external_channel_handles enable row level security;

drop policy if exists external_channels_select_self on public.external_channel_handles;
create policy external_channels_select_self on public.external_channel_handles
  for select using (auth.uid() = user_id);

drop policy if exists external_channels_insert_self on public.external_channel_handles;
create policy external_channels_insert_self on public.external_channel_handles
  for insert with check (auth.uid() = user_id);

drop policy if exists external_channels_update_self on public.external_channel_handles;
create policy external_channels_update_self on public.external_channel_handles
  for update using (auth.uid() = user_id);

drop policy if exists external_channels_delete_self on public.external_channel_handles;
create policy external_channels_delete_self on public.external_channel_handles
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Institution-paid channel enablement
-- =============================================================================
create table if not exists public.institution_nudge_settings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  channel text not null check (channel in ('telegram', 'discord', 'whatsapp')),
  enabled_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.users(id),
  unique (institution_id, channel)
);

create index if not exists idx_inst_nudge_settings_inst_channel
  on public.institution_nudge_settings (institution_id, channel);

alter table public.institution_nudge_settings enable row level security;

drop policy if exists inst_nudge_settings_select_members on public.institution_nudge_settings;
create policy inst_nudge_settings_select_members on public.institution_nudge_settings
  for select using (
    exists (
      select 1 from public.institution_members m
      where m.institution_id = institution_nudge_settings.institution_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists inst_nudge_settings_write_officers on public.institution_nudge_settings;
create policy inst_nudge_settings_write_officers on public.institution_nudge_settings
  for all using (
    exists (
      select 1 from public.institution_members m
      where m.institution_id = institution_nudge_settings.institution_id
        and m.user_id = auth.uid()
        and m.role in ('placement_officer', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.institution_members m
      where m.institution_id = institution_nudge_settings.institution_id
        and m.user_id = auth.uid()
        and m.role in ('placement_officer', 'admin')
    )
  );
