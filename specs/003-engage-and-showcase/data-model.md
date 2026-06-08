# Data Model: Engage & Showcase

**Phase 1 output** for `003-engage-and-showcase`. All new entities, column extensions, and state transitions.

## New tables

### `public.user_dsa_profiles`

Per-user, per-platform DSA data synced from LeetCode and HackerRank.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `user_id` | `uuid not null references public.users(id) on delete cascade` | one row per (user, platform) |
| `platform` | `text not null check (platform in ('leetcode','hackerrank'))` | |
| `username` | `text not null` | immutable after creation; reconnect creates a new row |
| `total_solved` | `integer not null default 0` | |
| `easy_solved` | `integer not null default 0` | LeetCode only; 0 for HackerRank |
| `medium_solved` | `integer not null default 0` | LeetCode only; 0 for HackerRank |
| `hard_solved` | `integer not null default 0` | LeetCode only; 0 for HackerRank |
| `contest_rating` | `integer` | LeetCode only; null for HackerRank |
| `streak_days` | `integer not null default 0` | |
| `badges` | `jsonb not null default '[]'::jsonb` | HackerRank shape: `[{name, stars, url}]` |
| `last_active_at` | `timestamptz` | |
| `last_synced_at` | `timestamptz not null default now()` | |
| `sync_status` | `text not null default 'active' check (sync_status in ('active','rate_limited','private','not_found','error'))` | |
| `created_at` | `timestamptz not null default now()` | |

**Constraints**:
- `unique (user_id, platform)` — one row per platform per user.
- `check (length(username) between 2 and 30)` — matches the spec's input validation.

**Indexes**:
- `idx_user_dsa_user_platform` on `(user_id, platform)`
- `idx_user_dsa_sync_due` on `(last_synced_at)` where `sync_status = 'active'` — partial index for the cron job.

**RLS**:
- `select`: `auth.uid() = user_id` OR the profile is referenced by a public `candidate_profiles` row whose visibility is `public`.
- `insert/update/delete`: `auth.uid() = user_id` (writes go through the `dsa-sync` edge function with service role; the client-side path is read-only).

### `public.slug_redirects`

History of public-profile slugs for 90-day 301 redirects.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `old_slug` | `text not null unique` | lowercase, kebab-case |
| `new_slug` | `text not null` | current slug of the user |
| `user_id` | `uuid not null references public.users(id) on delete cascade` | |
| `expires_at` | `timestamptz not null default (now() + interval '90 days')` | |

**Indexes**:
- `idx_slug_redirects_old_slug` on `(old_slug)` where `expires_at > now()` — partial index for the middleware lookup.

**RLS**: No client-side reads; this is server-managed.

### `public.external_channel_handles`

Per-user, per-channel handle + verification state. Replaces ad-hoc columns on `users` and `nudge_preferences`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `user_id` | `uuid not null references public.users(id) on delete cascade` | |
| `channel` | `text not null check (channel in ('discord','telegram','whatsapp'))` | |
| `handle` | `text not null` | Discord: full username+discriminator or new `@user`; Telegram: `@username` or `chat_id`; WhatsApp: E.164 phone |
| `platform_id` | `text` | e.g., Discord user id, Telegram chat id — populated only after the bot confirms |
| `verified_at` | `timestamptz` | null until the bot / OAuth callback confirms |
| `disconnected_reason` | `text` | nullable; set when the channel is auto-disconnected |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | |

**Constraints**:
- `unique (user_id, channel)` — one handle per channel per user; re-connecting creates a new row with a `disconnected_reason` on the old.

**Indexes**:
- `idx_external_channels_user_channel` on `(user_id, channel)`
- `idx_external_channels_verified` on `(user_id)` where `verified_at is not null and disconnected_reason is null` — partial index for the dispatcher's hot path.

**RLS**:
- `select`: `auth.uid() = user_id`.
- `insert/update/delete`: `auth.uid() = user_id`; service role bypasses RLS for the OAuth/webhook callbacks.

### `public.institution_nudge_settings`

College-paid channel enablement. A row in this table means "this institution has paid for this channel for all its students."

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `institution_id` | `uuid not null references public.institutions(id) on delete cascade` | |
| `channel` | `text not null check (channel in ('telegram','discord','whatsapp'))` | |
| `enabled_at` | `timestamptz not null default now()` | |
| `expires_at` | `timestamptz` | null = no expiry |
| `created_by` | `uuid references public.users(id)` | the officer who enabled it |

**Constraints**:
- `unique (institution_id, channel)`.

**Indexes**:
- `idx_inst_nudge_settings_inst_channel` on `(institution_id, channel)`.

**RLS**:
- `select`: any member of the institution can read; service role writes.
- `insert/update/delete`: only `placement_officer` or `admin` of the institution.

## Extended table

### `public.nudge_preferences` (additive columns)

| Column | Type | Notes |
|---|---|---|
| `channel_priority` | `text not null default 'in_app' check (channel_priority in ('in_app','telegram','discord','whatsapp'))` | where the student WANTS to receive nudges |
| `whatsapp_premium_opt_in` | `boolean not null default false` | gates the WhatsApp channel |

The actual `handle` storage moves from `nudge_preferences` to `external_channel_handles`. The 002 columns `discord_handle` / `telegram_handle` on `nudge_preferences` are deprecated by `external_channel_handles`; we'll keep them for one release as a fallback during the migration, then drop.

## State transitions

### `external_channel_handles.verified_at`

```
[ unverified ] --bot confirms--> [ verified ] --4xx from bot--> [ disconnected ]
                                   ^                                                  
                                   └──── user reconnects (new row) ────┘
```

### `slug_redirects`

- Created automatically by a `before update` trigger on the public-profile slug column (added to `candidate_profiles` if not already there; otherwise to a dedicated `public_profiles` table that we'll add in this migration).
- Expired rows are deleted by a daily cron (1h after midnight UTC) to keep the partial index small.

### `user_dsa_profiles.sync_status`

```
[ active ] --404/403--> [ not_found | private ] --user reconnects--> [ active ]
   |
   +--429--> [ rate_limited ] --6h retry--> [ active ]
   |
   +--other 4xx/5xx--> [ error ] --3 retries--> [ active | error ]
```

## RLS summary

All new tables are `enable row level security`. Policies follow the 001+002 patterns:
- `select` policies keyed to `auth.uid() = user_id` (or institution membership for institution-scoped tables).
- `insert/update/delete` policies are tighter (typically self-only).
- Edge functions and webhooks use the service role key to bypass RLS.
