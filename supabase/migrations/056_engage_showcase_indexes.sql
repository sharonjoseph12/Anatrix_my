-- supabase/migrations/022_engage_showcase_indexes.sql
-- T053 — Performance indexes added on top of 017/018/019 to keep the
-- dispatch hot path and the public-profile middleware O(1).
--
-- All IF NOT EXISTS so re-runs are safe.

-- DSA: cron sweep + status filter.
create index if not exists idx_user_dsa_profiles_due
  on public.user_dsa_profiles (last_synced_at)
  where sync_status = 'active';

-- Channels: hot path in the dispatcher is "verified handles for user X".
create index if not exists idx_external_channel_handles_verified
  on public.external_channel_handles (user_id, channel)
  where verified_at is not null;

-- Slug redirects: middleware looks up old_slug where not expired.
create index if not exists idx_slug_redirects_unexpired
  on public.slug_redirects (old_slug, new_slug);

-- candidate_profiles: already has unique (slug) from 017; add covering
-- index for sitemap / public listing.
create index if not exists idx_candidate_profiles_public_score
  on public.candidate_profiles (last_score_change_at desc nulls last, slug)
  where is_public = true and slug is not null;
