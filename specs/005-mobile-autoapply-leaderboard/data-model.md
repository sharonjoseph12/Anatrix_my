# Data Model: 005 — Mobile, Auto-Apply, Leaderboard

**Date**: 2026-06-07
**Status**: Phase 1 design ratified; 2 additive migrations (051 main, 052 cron)
**Builds on**: 001-008 schema (042 existing migrations; the user has reserved 051 and 052 for this feature)
**Migration map**:

| Migration | Objects Added | Tables Extended | Notes |
|---|---|---|---|
| `051_mobile_autoapply.sql` | `auto_apply_log`, `auto_apply_templates`, `leaderboard_share_cards`, `leaderboard_opt_outs`, `mobile_device_tokens`, `mobile_app_sessions`, `mv_cross_college_leaderboard` (MATERIALIZED VIEW) | `users` (+`cover_letter_drafts_today`, +`last_mobile_session_at`), `student_applications` (+`cover_letter_text`, +`auto_apply_session_id`) | 6 tables + 1 MV + 3 column additions |
| `052_cron_005.sql` | (no new tables) | (no extensions) | Cron consolidation: `leaderboard-refresh`, `leaderboard-tier-recompute`, `mobile-token-cleanup`, `auto-apply-daily-cap-reset`, `leaderboard-opt-out-propagator` |

Total new tables: **6**. Total new materialized views: **1**. Total extended tables: **2** (`users` and `student_applications`).

---

## 051 — Mobile + Auto-Apply + Leaderboard

### `auto_apply_log`
Append-only log of every step in a Playwright auto-apply session. One row per step event.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | bigserial | PK | |
| `session_id` | uuid | NOT NULL | FK to `auto_apply_sessions.id` (created in `apps/auto-apply` runtime); not enforced at DB layer since the service is external |
| `student_id` | uuid | NOT NULL, FK `users(id)` ON DELETE CASCADE | Denormalised for fast student lookup |
| `job_url` | text | NOT NULL | The ATS form URL |
| `step` | text | NOT NULL, CHECK in (`'session_started'`,`'navigate'`,`'fill_field'`,`'screenshot'`,`'render_preview'`,`'captcha_detected'`,`'sso_required'`,`'resume_after_captcha'`,`'resume_after_sso'`,`'submit'`,`'abandoned'`,`'timeout'`,`'error'`,`'kill_switch_hit'`) | |
| `latency_ms` | int | nullable | Per-step latency |
| `screenshot_url` | text | nullable | Signed Supabase storage URL; expires 7 days after session end |
| `payload_json` | jsonb | nullable | Step-specific (e.g. `{field: "name", value: "..."}` for fill_field) |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

**Indexes**: `(student_id, created_at DESC)`, `(session_id, created_at)`, `(step)`.
**RLS**: student sees own; `app_admins` read all; service role full.

### `auto_apply_templates`
Per-domain job-form field mappings + kill-switch.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `domain` | text | NOT NULL, UNIQUE | e.g. `careers.razorpay.com` |
| `company_id` | uuid | nullable, FK `companies(id)` | NULL for non-Antarix-owned ATS |
| `field_map_json` | jsonb | NOT NULL | e.g. `{"name":"users.full_name","email":"users.email","phone":"users.phone","education":"verifiable_credentials[kind=education]","projects":"verifiable_credentials[kind=project]","github":"users.github_handle"}` |
| `disabled_for_domain` | boolean | NOT NULL, default false | The per-domain kill-switch |
| `disabled_reason` | text | nullable | e.g. `"ToS risk: form submission violates LinkedIn TOS"` |
| `last_verified_at` | timestamptz | nullable | Last time an `app_admin` re-ran the form filler against this domain |
| `last_verified_by` | uuid | nullable, FK `users(id)` | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

**Indexes**: `(domain)` (UNIQUE), `(disabled_for_domain) WHERE disabled_for_domain = true`.
**RLS**: read-only for authenticated; `app_admins` write.

### `leaderboard_share_cards`
Per-rank share-card cache (server-rendered PNG + OG metadata).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `student_id` | uuid | NOT NULL, FK `users(id)` ON DELETE CASCADE | |
| `period` | text | NOT NULL, CHECK in (`'weekly'`,`'monthly'`,`'all_time'`) | |
| `kind` | text | NOT NULL, CHECK in (`'skill_proof_score'`,`'streak'`,`'mock_interview'`,`'mentor_session'`,`'collab_teamwork'`) | |
| `rank` | int | NOT NULL, CHECK 1..100 | |
| `score` | numeric(5,2) | NOT NULL | |
| `tier_band` | text | NOT NULL, CHECK in (`'bronze'`,`'silver'`,`'gold'`,`'platinum'`,`'diamond'`) | |
| `handle` | text | NOT NULL | Display name (first-name + last-initial) |
| `college_name` | text | NOT NULL | |
| `year` | smallint | NOT NULL, CHECK 1..5 | |
| `png_url` | text | NOT NULL | Signed Supabase storage URL |
| `og_metadata_json` | jsonb | NOT NULL | `{og_image, og_title, og_description, canonical_url}` |
| `rendered_at` | timestamptz | NOT NULL, default `now()` | |
| `expires_at` | timestamptz | NOT NULL | Default `now() + interval '1 hour'` |

**Indexes**: `(student_id, period, kind)`, `(expires_at)` partial WHERE `expires_at > now()`.
**RLS**: student sees own; public read by `id` (signed URL); `app_admins` full.
**UNIQUE**: `(student_id, period, kind)` — one card per (student, period, kind).

### `leaderboard_opt_outs`
Per-student opt-out toggle for the global leaderboard.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, UNIQUE, FK `users(id)` ON DELETE CASCADE | One row per user |
| `opted_out` | boolean | NOT NULL, default false | Default false = opt-in |
| `opted_out_at` | timestamptz | nullable | When the user flipped to opted_out=true |
| `opted_in_at` | timestamptz | nullable | When the user flipped back to opted_out=false |
| `reason` | text | nullable | Optional free-text; never exposed publicly |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

**Indexes**: `(opted_out) WHERE opted_out = true` (for MV join).
**RLS**: student reads/writes own; `app_admins` read all; service role full.
**Trigger**: on `INSERT` or `UPDATE` of `opted_out`, fire `pg_notify('leaderboard_opt_out_changed', NEW.user_id::text)` for the API layer's 60s denormalized cache.

### `mobile_device_tokens`
Per-(user, device) push token, multi-kind.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK `users(id)` ON DELETE CASCADE | |
| `device_id` | text | NOT NULL | Stable per-install UUID; emitted by the mobile app |
| `kind` | text | NOT NULL, CHECK in (`'apns'`,`'fcm'`,`'web_push_legacy'`) | |
| `token` | text | NOT NULL | The push token (APNs device token, FCM registration token, or VAPID endpoint) |
| `app_version` | text | NOT NULL | e.g. `1.0.0+12` |
| `os` | text | NOT NULL, CHECK in (`'ios'`,`'android'`,`'web'`) | |
| `os_version` | text | NOT NULL | |
| `last_seen_at` | timestamptz | NOT NULL, default `now()` | |
| `soft_deleted_at` | timestamptz | nullable | Tokens not seen in 30 days are soft-deleted by the cron |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

**Indexes**: `(user_id)`, `(last_seen_at) WHERE soft_deleted_at IS NULL`, `(device_id)`.
**RLS**: user sees own; service role full.
**UNIQUE**: `(user_id, device_id, kind)` — one token per (user, device, channel).

### `mobile_app_sessions`
Per-cold-start session analytics.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK `users(id)` ON DELETE CASCADE | |
| `device_id` | text | NOT NULL | Stable per-install UUID |
| `app_version` | text | NOT NULL | |
| `os` | text | NOT NULL, CHECK in (`'ios'`,`'android'`) | |
| `started_at` | timestamptz | NOT NULL, default `now()` | |
| `last_heartbeat_at` | timestamptz | NOT NULL, default `now()` | Updated by the mobile app every 60s |
| `ended_at` | timestamptz | nullable | Set by the cron at 30m idle |
| `ended_reason` | text | nullable, CHECK in (`'foreground_30m_idle'`,`'user_logout'`,`'crash'`) | |
| `crash_report_url` | text | nullable | Signed Supabase storage URL for the crash log |

**Indexes**: `(user_id, started_at DESC)`, `(last_heartbeat_at) WHERE ended_at IS NULL`, `(device_id)`.
**RLS**: user sees own; service role full.

### `mv_cross_college_leaderboard` (Postgres MATERIALIZED VIEW)

The leaderboard source of truth. Refreshed nightly by `leaderboard-refresh` edge function via `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Opt-out is enforced at the MV level (the view's SELECT policy is `WHERE opted_out = false`).

| Column | Type | Notes |
|---|---|---|
| `rank` | int | 1..100 within (period, kind) |
| `period` | text | `weekly`, `monthly`, `all_time` |
| `kind` | text | `skill_proof_score`, `streak`, `mock_interview`, `mentor_session`, `collab_teamwork` |
| `student_id` | uuid | FK `users(id)` |
| `handle` | text | Display name (first-name + last-initial) |
| `college_id` | uuid | FK `institutions(id)` |
| `college_name` | text | |
| `year` | smallint | 1..5 |
| `specialization` | text | e.g. `ai_ml`, `fullstack`, `data_science` |
| `score` | numeric(5,2) | Period-and-kind-specific |
| `tier_band` | text | `bronze`, `silver`, `gold`, `platinum`, `diamond` |
| `top_achievements_json` | jsonb | `[{"kind":"credential","label":"Stripe-API Capstone"},{"kind":"mentor_session","label":"3 sessions"},{"kind":"streak","label":"14 days"}]` |
| `opted_out` | boolean | Denormalised from `leaderboard_opt_outs.opted_out`; re-checked at API layer for 60s propagation |
| `computed_at` | timestamptz | When this row was materialised |

**Indexes**:
- `UNIQUE (period, kind, rank)` — supports fast top-N queries
- `(period, kind, score DESC)` — supports `ORDER BY score DESC LIMIT 100`
- `(student_id, period, kind)` — supports per-student lookup

**RLS**: SELECT policy is `WHERE opted_out = false` (defense in depth). No INSERT/UPDATE/DELETE (MV is read-only by definition).

**Materialization logic** (simplified, see `apps/web/src/lib/leaderboard/materializer.ts`):

```sql
-- weekly skill_proof_score top-100
SELECT
  RANK() OVER (ORDER BY cps.score DESC) AS rank,
  'weekly' AS period,
  'skill_proof_score' AS kind,
  cps.student_id, ...
FROM candidate_profile_scores cps
LEFT JOIN leaderboard_opt_outs loo ON loo.user_id = cps.student_id
WHERE cps.week_start = date_trunc('week', now())
  AND (loo.opted_out IS NULL OR loo.opted_out = false)
ORDER BY cps.score DESC
LIMIT 100;
```

(Analogous SELECT for `monthly`, `all_time`, and the other 4 kinds.)

**Refresh strategy**:
- `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cross_college_leaderboard;`
- Requires the `UNIQUE (period, kind, rank)` index above
- On lock failure: log + retry with exponential backoff; on 3rd failure, page on-call
- Staleness header on the API: `X-Leaderboard-Staleness: <seconds>`

### Extensions to existing tables

#### `users` (add columns)
- `cover_letter_drafts_today` smallint NOT NULL DEFAULT 0 — denormalized counter, reset by cron at `LEADERBOARD_CRON_HOUR_UTC=2` for users whose local day has rolled over
- `last_mobile_session_at` timestamptz nullable — updated by mobile app on cold-start; used by the leaderboard opt-out propagator to skip non-mobile users

#### `student_applications` (add columns)
- `cover_letter_text` text nullable — populated on "Save & apply" with the LLM-drafted letter (≤ 400 words)
- `auto_apply_session_id` text nullable — the auto-apply session id (not a FK; the session lives in the external Node service); nullable for non-auto-apply applications

---

## 052 — Cron consolidation

`052_cron_005.sql` is a pure cron migration. No new tables; no extensions. It registers 5 cron jobs:

| Cron job | Schedule | Edge function | Notes |
|---|---|---|---|
| `005-leaderboard-refresh` | `LEADERBOARD_CRON_HOUR_UTC` (default 02:00 UTC, daily) | `leaderboard-refresh` | `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cross_college_leaderboard` |
| `005-leaderboard-tier-recompute` | Sunday 03:00 UTC | `leaderboard-tier-recompute` | Recomputes percentile bands from the opted-in cohort; updates `leaderboard_share_cards.tier_band` |
| `005-mobile-token-cleanup` | Daily 04:00 UTC | `mobile-token-cleanup` | Soft-deletes `mobile_device_tokens` rows with `last_seen_at < now() - interval '30 days'` |
| `005-auto-apply-daily-cap-reset` | Daily 00:00 UTC | `auto-apply-daily-cap-reset` | Resets `users.cover_letter_drafts_today = 0` for users whose `users.timezone` local day has rolled over |
| `005-leaderboard-opt-out-propagator` | Every 60s | `leaderboard-opt-out-propagator` | Subscribes to `pg_notify('leaderboard_opt_out_changed', ...)`, updates the API-layer in-memory denorm cache (process-local; restarts in < 60s anyway) |

---

## Cross-table relationships (Mermaid)

```mermaid
erDiagram
    users ||--o{ auto_apply_log : triggers
    users ||--o{ mobile_device_tokens : owns
    users ||--o{ mobile_app_sessions : opens
    users ||--|| leaderboard_opt_outs : toggles
    users ||--o{ leaderboard_share_cards : shares
    users ||--o{ student_applications : applies
    student_applications }o--o| auto_apply_log : session_logged
    auto_apply_templates ||--o{ auto_apply_log : domain_template
    companies ||--o{ auto_apply_templates : owns_domain
    institutions ||--o{ mv_cross_college_leaderboard : aggregates
    mv_cross_college_leaderboard }o--|| users : student_in_view
    mv_cross_college_leaderboard }o--|| leaderboard_opt_outs : excluded_if_opted_out

    users {
        uuid id PK
        smallint cover_letter_drafts_today
        timestamptz last_mobile_session_at
    }
    auto_apply_log {
        bigserial id PK
        uuid student_id FK
        text step
        text job_url
    }
    auto_apply_templates {
        uuid id PK
        text domain UK
        boolean disabled_for_domain
    }
    leaderboard_share_cards {
        uuid id PK
        uuid student_id FK
        text period
        text kind
        int rank
    }
    leaderboard_opt_outs {
        uuid id PK
        uuid user_id FK_UK
        boolean opted_out
    }
    mobile_device_tokens {
        uuid id PK
        uuid user_id FK
        text device_id
        text kind
    }
    mobile_app_sessions {
        uuid id PK
        uuid user_id FK
        text device_id
        timestamptz started_at
    }
    mv_cross_college_leaderboard {
        int rank
        text period
        text kind
        uuid student_id FK
        numeric score
    }
```

---

## Re-validation

- ✓ All 6 spec entities + 1 materialized view + 2 extended tables + 1 cron migration mapped
- ✓ All FK references resolve to existing 001-008 tables or new 005 tables
- ✓ All CHECK constraints align with spec FR-* rules (5-check for tiers, 5-check for period, etc.)
- ✓ All performance-critical queries have supporting indexes (top-100 by period+kind+score; per-user device token; per-student log lookup; opt-out partial index)
- ✓ All multi-tenant tables have RLS policy plan; the MV has a SELECT-only policy
- ✓ Migration order is strictly additive (no DROP/ALTER on existing critical columns; 2 column additions to `users` and `student_applications` are backward-compatible)
- ✓ Materialized view uses `REFRESH MATERIALIZED VIEW CONCURRENTLY` (requires `UNIQUE` index, provided)
- ✓ Opt-out is 3-layer enforced (MV-level SELECT + RLS + API-level recheck)
- ✓ Cron jobs are documented in `052_cron_005.sql` with their schedules and edge functions
- ✓ `leaderboard_opt_outs` UNIQUE on `user_id` prevents duplicate opt-out rows
- ✓ `mobile_device_tokens` UNIQUE on `(user_id, device_id, kind)` prevents duplicate token registrations
- ✓ `auto_apply_log.screenshot_url` is signed; expires 7 days after session end (enforced by Supabase storage TTL)
- ✓ `leaderboard_share_cards` UNIQUE on `(student_id, period, kind)` prevents duplicate card renders
