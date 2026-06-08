# API Contracts: 005 — Mobile, Auto-Apply, Leaderboard

**Date**: 2026-06-07
**Status**: Phase 1 design ratified
**Builds on**: 001-008 internal API surfaces (reused for the mobile app's read paths), 004 public API (reused for the leaderboard public read).

Three API surfaces: **internal** (Next.js API routes, Supabase-auth-gated, RLS-enforced), **public** (`/api/v1/public/leaderboard/*`, IP rate-limited, no API key), and **mobile** (Expo app → internal, with extra device-token + heartbeat endpoints).

---

## Internal: Auto-Apply

### `POST /api/auto-apply/cover-letter`

**Auth**: student session.

**Request body**:
```json
{
  "job_id": "uuid",
  "job_description": "We are looking for an SDE-1 to join our payments team. You will work on..."
}
```

**Response 200**:
```json
{
  "draft_id": "uuid",
  "cover_letter": {
    "salutation": "Dear Razorpay Hiring Team,",
    "body": "...280 words, concrete, warm, no buzzword bingo..."
  },
  "tokens_used": 1850,
  "drafts_remaining_today": 4
}
```

**Errors**:
- `400 invalid_input` — `job_id` is not a UUID; `job_description` is empty
- `404 not_found` — `job_id` not found in `job_matches` for this student
- `422 unprocessable` — student has no verified credentials (cannot draft a cover letter)
- `429 rate_limited` — daily cap exceeded; body: `{ "error": { "code": "daily_draft_cap_exceeded", "message": "You've drafted 5 of 5 — try again at 00:00 local.", "reset_at": "2026-06-08T00:00:00+05:30" } }`
- `429 rate_limited` — weekly LLM cap exceeded; body: `{ "error": { "code": "weekly_token_cap_exceeded", "retry_after_seconds": 86400 } }`
- `503 service_unavailable` — LLM primary + fallback both down

**Side effects**:
- Increments `users.cover_letter_drafts_today` atomically (rolls back on LLM failure)
- Writes a `cover_letter_drafts` row (audit) — table is in the 051 migration scope, included for cost reconciliation
- Returns the draft for the student to review/edit

### `POST /api/auto-apply/session`

**Auth**: student session.

**Request body**:
```json
{
  "job_id": "uuid",
  "embed_view": "mobile" | "web"
}
```

**Response 200**:
```json
{
  "session_id": "uuid",
  "embed_url": "https://auto-apply.antarix.app/sessions/<session_id>?token=<short-lived-jwt>",
  "expires_at": "2026-06-07T18:05:00Z",
  "kill_switch_active": false
}
```

**Errors**:
- `400 invalid_input` — `job_id` is not a UUID; `embed_view` is not in the union
- `404 not_found` — `job_id` not found
- `403 forbidden` — domain is on the kill-switch list; body: `{ "error": { "code": "kill_switch_active", "domain": "linkedin.com", "reason": "ToS risk" } }`
- `429 rate_limited` — per-tenant concurrency cap reached; body: `{ "error": { "code": "tenant_concurrency_exceeded", "retry_after_seconds": 30 } }`
- `503 service_unavailable` — auto-apply service is down

**Side effects**:
- POSTs to `AUTO_APPLY_SERVICE_URL/sessions` to provision a Playwright headless session
- Writes an `auto_apply_log` row with `step='session_started'`
- The `embed_url` is a short-lived JWT (5 min) that authenticates the embed view to the auto-apply service

### `GET /api/auto-apply/session/{id}`

**Auth**: student session (must own the session).

**Response 200**:
```json
{
  "session_id": "uuid",
  "status": "active" | "captcha_paused" | "sso_paused" | "submitted" | "abandoned" | "timeout" | "error",
  "started_at": "2026-06-07T18:00:00Z",
  "expires_at": "2026-06-07T18:05:00Z",
  "last_step": "fill_field",
  "last_step_at": "2026-06-07T18:02:13Z",
  "form_url": "https://careers.razorpay.com/apply/12345",
  "prefilled_fields": ["name", "email", "phone", "education", "projects", "github"],
  "remaining_fields": ["why_razorpay_free_text"]
}
```

### `POST /api/auto-apply/session/{id}/step`

**Auth**: auto-apply service (machine-to-machine with shared secret).

**Request body**:
```json
{
  "step": "fill_field" | "navigate" | "screenshot" | "render_preview" | "captcha_detected" | "sso_required" | "resume_after_captcha" | "resume_after_sso" | "abandoned" | "timeout" | "error" | "kill_switch_hit",
  "latency_ms": 142,
  "screenshot_url": "https://...",
  "payload": { "field": "name", "value": "..." }
}
```

**Response 204** (no content).

**Side effects**:
- INSERTs into `auto_apply_log`
- On `step='captcha_detected' | 'sso_required'`: the session is paused; the embed view shows the student the pause CTA
- On `step='kill_switch_hit'`: the session is force-ended; the student sees "this domain is disabled — apply manually"

### `POST /api/auto-apply/session/{id}/submit`

**Auth**: student session (must own the session). This is the **only** endpoint that posts the form; the embed view's `onClick` handler calls it. The agent never calls it.

**Request body**: `{}` (empty; the form state lives in the embed view).

**Response 200**:
```json
{
  "student_application_id": "uuid",
  "status": "submitted",
  "submitted_at": "2026-06-07T18:04:32Z"
}
```

**Side effects**:
- INSERTs `auto_apply_log` with `step='submit'`
- UPDATEs `student_applications.status='submitted'`, sets `student_applications.auto_apply_session_id=<session_id>`
- Sends a confirmation nudge via 003

### `GET /api/auto-apply/daily-cap`

**Auth**: student session.

**Response 200**:
```json
{
  "drafts_today": 2,
  "daily_cap": 5,
  "remaining": 3,
  "reset_at": "2026-06-08T00:00:00+05:30",
  "weekly_tokens_used": 8200,
  "weekly_token_cap": 20000
}
```

---

## Internal: Leaderboard (recruiter view)

### `GET /api/leaderboards/global`

**Auth**: recruiter session. RLS filters by `recruiter.company_id` and the `company_college_partnerships` table.

**Query parameters**:
- `period=weekly|monthly|all_time` (default `weekly`)
- `college_id=uuid` (optional)
- `year=1|2|3|4|5` (optional)
- `specialization=ai_ml|fullstack|data_science|...` (optional)
- `limit=1..100` (default 100)
- `offset=0..` (default 0)

**Response 200**:
```json
{
  "period": "weekly",
  "count_total": 49950,
  "count_returned": 100,
  "filter": { "college_id": "uuid", "year": 3, "specialization": "fullstack" },
  "leaderboard": [
    {
      "rank": 1,
      "student_id": "uuid",
      "handle": "Ananya S.",
      "college_id": "uuid",
      "college_name": "IIT Bombay",
      "year": 3,
      "specialization": "fullstack",
      "score": 94.7,
      "tier_band": "diamond",
      "top_achievements": [
        { "kind": "credential", "label": "Stripe-API Capstone" },
        { "kind": "mentor_session", "label": "3 sessions" },
        { "kind": "streak", "label": "14 days" }
      ]
    }
  ],
  "next_offset": null
}
```

**Errors**:
- `400 invalid_input` — `period` not in union
- `403 forbidden` — recruiter's company has no partnership with the requested `college_id`

### `POST /api/leaderboards/opt-out`

**Auth**: student session.

**Request body**:
```json
{
  "reason": "prefer private"  // optional
}
```

**Response 200**:
```json
{
  "opted_out": true,
  "opted_out_at": "2026-06-07T18:00:00Z"
}
```

**Side effects**:
- UPSERTs `leaderboard_opt_outs` with `opted_out=true`, `opted_out_at=now()`
- Fires `pg_notify('leaderboard_opt_out_changed', NEW.user_id::text)` for the API-layer 60s cache
- The MV's next refresh will exclude this user

### `DELETE /api/leaderboards/opt-out`

**Auth**: student session.

**Response 200**:
```json
{
  "opted_out": false,
  "opted_in_at": "2026-06-07T18:05:00Z"
}
```

**Side effects**: same as POST, with `opted_out=false`.

### `GET /api/leaderboards/share-card/{rank_id}.png`

**Auth**: public (the URL is a signed token bound to the rank).

**Response 200**: `image/png`, 1200×630. Generated by `@vercel/og` (satori + resvg-js).

**Response headers**:
- `Cache-Control: public, max-age=3600` (1 hour; `leaderboard_share_cards.expires_at`)
- `Content-Type: image/png`

**Errors**:
- `404 not_found` — `rank_id` not found or expired
- `403 forbidden` — the student is opted out; the card cannot be generated

### `GET /api/leaderboards/share-card/{rank_id}`

**Auth**: public.

**Response 200** (HTML; for crawlers + share-sheet previews):
```json
{
  "og_image": "https://antarix.app/api/leaderboards/share-card/<rank_id>.png",
  "og_title": "Ananya S. is ranked #1 globally on Antarix this week — 94.7 Skill Proof Score",
  "og_description": "Verified by Antarix. View the public credential at antarix.app/verify/<slug>",
  "canonical_url": "https://antarix.app/share/leaderboard/<rank_id>",
  "tier_band": "diamond",
  "rank": 1,
  "score": 94.7
}
```

---

## Public: `/api/v1/public/leaderboard/*` (no API key; IP rate-limited at 60 req/min)

### `GET /api/v1/public/leaderboard/global`

**Auth**: public, IP rate-limited.

**Query parameters**:
- `period=weekly|monthly|all_time` (default `weekly`)
- `kind=skill_proof_score|streak|mock_interview|mentor_session|collab_teamwork` (default `skill_proof_score`)
- `limit=1..100` (default 100)
- `offset=0..` (default 0)

**Response 200**:
```json
{
  "period": "weekly",
  "kind": "skill_proof_score",
  "count_total": 49950,
  "count_returned": 100,
  "computed_at": "2026-06-07T02:00:00Z",
  "staleness_seconds": 120,
  "leaderboard": [
    { "rank": 1, "handle": "Ananya S.", "college_name": "IIT Bombay", "year": 3, "score": 94.7, "tier_band": "diamond" }
  ],
  "next_offset": null
}
```

**Response headers**:
- `Cache-Control: public, max-age=30`
- `X-Leaderboard-Staleness: <seconds>` — how stale the data is (since last successful refresh)
- `X-RateLimit-Remaining`, `X-RateLimit-Reset` — IP rate limit

**Errors**:
- `400 invalid_input` — `period` or `kind` not in union
- `429 rate_limited` — IP exceeded 60 req/min; body: `{ "error": { "code": "rate_limited", "retry_after_seconds": 60 } }`

---

## Internal: Mobile

### `POST /api/mobile/register-device`

**Auth**: student session.

**Request body**:
```json
{
  "device_id": "stable-uuid-per-install",
  "kind": "apns" | "fcm" | "web_push_legacy",
  "token": "<push-token>",
  "app_version": "1.0.0+12",
  "os": "ios" | "android",
  "os_version": "17.4"
}
```

**Response 200**:
```json
{
  "registered_at": "2026-06-07T18:00:00Z",
  "priority": 1   // 1=APNs/FCM, 2=web-push fallback
}
```

**Side effects**:
- UPSERTs `mobile_device_tokens`; the dispatcher uses the new token for subsequent pushes
- Updates `users.last_mobile_session_at`

### `POST /api/mobile/session`

**Auth**: student session.

**Request body**:
```json
{
  "device_id": "stable-uuid-per-install",
  "app_version": "1.0.0+12",
  "os": "ios" | "android"
}
```

**Response 200**:
```json
{
  "session_id": "uuid",
  "started_at": "2026-06-07T18:00:00Z"
}
```

**Side effects**:
- INSERTs `mobile_app_sessions` with `started_at=now()`, `last_heartbeat_at=now()`

### `PATCH /api/mobile/session/{id}`

**Auth**: student session.

**Request body**:
```json
{
  "heartbeat": true
}
```

**Response 204** (no content).

**Side effects**:
- UPDATEs `mobile_app_sessions.last_heartbeat_at=now()`; the cron marks sessions idle at 30 min

### `POST /api/mobile/deep-link`

**Auth**: student session.

**Request body**:
```json
{
  "resume_token": "opaque-24h-ttl-token"
}
```

**Response 200**:
```json
{
  "resume_step": "biometric_login" | "dashboard" | "...",
  "expires_at": "2026-06-08T18:00:00Z"
}
```

**Errors**:
- `404 not_found` — `resume_token` is unknown or expired

---

## Internal: Push (extends 003)

### `POST /api/push/send`

**Auth**: service role (machine-to-machine; called by nudge dispatcher + leaderboard cron + 003).

**Request body**:
```json
{
  "user_id": "uuid",
  "title": "Streak at risk!",
  "body": "Open the app before midnight to keep your 14-day streak.",
  "deeplink": "antarix://streak",
  "data": { "kind": "streak_at_risk", "streak_count": 14 }
}
```

**Response 200**:
```json
{
  "channel_used": "apns" | "fcm" | "web_push_legacy" | "none",
  "delivered": true,
  "device_token_id": "uuid"
}
```

**Side effects**:
- Looks up the user's `mobile_device_tokens`, picks the highest-priority available (`apns` > `fcm` > `web_push_legacy`)
- Dispatches to the chosen channel
- On failure, falls back to the next channel; on all-fail, logs and returns `delivered=false`

---

## Mobile app → internal API

The mobile app consumes the existing web API surface (`apps/web/src/app/api/*`) for all read paths:

- `GET /api/dashboard` — Skill Proof Score + 7-day sparkline (inherited from 002)
- `GET /api/skill-proof/breakdown` — per-skill contributions (inherited from 002)
- `GET /api/mentors` — 007 mentor list
- `GET /api/curriculum/today` — 007 today's 3 lessons
- `GET /api/collab/rooms/{id}` — 008 collab room (deep-link to web)
- `GET /api/settings/signals` — 006 signals/privacy surface (read-only in v1)
- `GET /api/job-matches` — 002 matched jobs
- `GET /api/streak` — 003 streak data
- `GET /api/v1/public/leaderboard/global` — this feature

All read-only in v1. Interactive features (request mentor, complete lesson, fill auto-apply form) are routed to the web surface via deep links (the mobile app opens a `WKWebView`/`Chrome Custom Tab`).

---

## Webhook delivery contract (push)

The push dispatcher wraps APNs / FCM / web-push into a single internal contract. The contract is **not** external (no third-party webhook subscription in 005); it is the internal dispatcher signature:

```
POST /api/push/send
Content-Type: application/json
Authorization: Bearer <service-role-jwt>

{
  "user_id": "uuid",
  "title": "...",
  "body": "...",
  "deeplink": "...",
  "data": { ... }
}
```

**Retry policy** (push-specific):
- APNs: 1 attempt; on 410 (unregistered) or 403 (bad token), soft-delete the token; fall through to the next channel
- FCM: 1 attempt; on `UNREGISTERED` or `INVALID_ARGUMENT`, soft-delete; fall through
- Web-push: 1 attempt; on 404 or 410, soft-delete; fall through to in-app inbox (003 nudge fallback)

---

## Rate limiting

- **Auto-apply cover letter**: 5 drafts/student/day (enforced server-side)
- **Auto-apply session create**: per-tenant concurrency cap of 5 (enforced in the auto-apply service)
- **Leaderboard public API**: 60 req/min per IP (enforced at the route)
- **Leaderboard recruiter view**: 100 req/min per recruiter (enforced at the route)
- **Mobile device registration**: 10 req/min per user (enforced at the route)
- **Share-card PNG render**: 5 req/min per user (enforced at the route; cached 1h)

---

## Error response shape (all endpoints)

```json
{
  "error": {
    "code": "rate_limited" | "invalid_input" | "not_found" | "forbidden" | "conflict" | "internal_error" | "kill_switch_active" | "tenant_concurrency_exceeded" | "daily_draft_cap_exceeded" | "weekly_token_cap_exceeded" | "...",
    "message": "<human-readable>",
    "details": { ... }   // optional structured field hints
  }
}
```

---

## Versioning

- Public leaderboard API is versioned in the URL (`/api/v1/public/leaderboard/*`).
- Internal API is unversioned (private to first-party clients).
- Breaking changes to public API trigger a new version path (`/api/v2/...`); previous version supported for ≥ 12 months.
