# API Contracts: Antarix 11/10 — New Endpoints

**Branch**: `002-antarix-definitive-vision` | **Date**: 2026-06-04
**Builds on**: `specs/001-antarix-complete-workflow/contracts/api.md`

This file documents only the **new** API contracts introduced by the 11/10 vision. The 001 endpoints (auth, sessions, profiles, company search, etc.) are retained as documented.

Base URL: `https://api.antarix.app` (production), `http://localhost:54321/functions/v1` (local).
Authentication: Bearer Supabase JWT in `Authorization` header, except where noted as public.

---

## WhatsApp Connection

### POST /whatsapp/connect
Begin WhatsApp opt-in. Returns a one-time opt-in code/URL the student sends to the WhatsApp Business number to complete linking.

**Request**:
```json
{ "phone_number": "+919876543210" }
```

**Response** (200):
```json
{
  "connection_id": "uuid",
  "opt_in_code": "ANT-7Q3X",
  "deep_link": "https://wa.me/<phone_number>?text=ANT-7Q3X",
  "expires_at": "2026-06-04T11:00:00Z"
}
```

**Errors**: `400 INVALID_PHONE`, `409 ALREADY_CONNECTED`, `429 RATE_LIMITED`.

---

### DELETE /whatsapp/connect
Disconnect WhatsApp. Stops all `whatsapp`-channel nudges for the student.

**Response** (204): No body.

---

### POST /whatsapp/webhook  *(provider → server, no JWT)*
Inbound webhook from the WhatsApp provider.

**Request** (Meta Cloud API format, simplified):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "919876543210",
          "type": "text",
          "text": { "body": "STATS" }
        }]
      }]
    }]
  }]
}
```

**Response** (200): `{ "ok": true }` — message processing is async; the provider is not retried.

**Effects**: The webhook handler (a) resolves `phone_number → user_id` via `whatsapp_connections`, (b) writes a `nudge_responses` row, (c) applies documented state changes (e.g., `START` → opens an ad-hoc session), and (d) sends a confirmation reply through `whatsapp-send`.

---

## Nudges (AI Coach)

### GET /nudges
List the student's nudge inbox (most recent first, paginated).

**Query**: `?limit=50&before=<cursor>&type=<type>`

**Response** (200):
```json
{
  "nudges": [
    {
      "id": "uuid",
      "type": "daily_morning",
      "channel": "whatsapp",
      "rendered_body": "🌅 Good morning Sharon! ...",
      "sent_at": "2026-06-04T02:30:00Z",
      "delivery_status": "delivered",
      "response": { "kind": "command", "command": "START", "received_at": "..." }
    }
  ],
  "next_cursor": "..."
}
```

---

### POST /nudges/trigger  *(admin / test only)*
Manually trigger a nudge for one student. Used by tests and by the AI Coach's event-driven triggers.

**Request**:
```json
{ "user_id": "uuid", "type": "daily_morning", "context": { "force": true } }
```

**Response** (202): `{ "nudge_id": "uuid" }`

---

### PUT /nudges/preferences
Update the student's nudge preferences. Equivalent to the in-app settings page.

**Request**:
```json
{
  "timezone": "Asia/Kolkata",
  "daily_send_local_time": "08:00",
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "07:00",
  "pause_all": false,
  "real_time_peak_nudges": true,
  "streak_risk_nudges": true,
  "whatsapp_channel": true,
  "push_channel": true,
  "dashboard_channel": true
}
```

**Response** (200): Updated `nudge_preferences` object.

---

## Skill Proof & Placement Prediction

### GET /skill-proof/me
Return the student's current Skill Proof Score and component breakdown.

**Response** (200):
```json
{
  "overall_score": 82,
  "weighting_profile": "power_mode",
  "components": {
    "github_activity": 35,
    "session_quality": 25,
    "consistency": 20,
    "peer_context": 20
  },
  "delta_from_last": 5,
  "computed_at": "2026-06-04T02:00:00Z",
  "data_freshness_days": 1
}
```

---

### GET /placement-prediction/me
Return the student's current placement prediction (latest, regardless of week).

**Response** (200):
```json
{
  "probability_0_100": 87,
  "company_tier": "tier_1",
  "time_to_ready_months": 1.5,
  "top_gaps": [
    { "skill": "DevOps", "gap_score": 0.72, "recommended_action": "Complete 1 cloud project" },
    { "skill": "System Design", "gap_score": 0.45, "recommended_action": "Solve 5 mock interviews" }
  ],
  "model_version": "v1-rule-augmented",
  "computed_at": "2026-06-02T10:00:00Z",
  "qualifying": true
}
```

**Errors**: `425 TOO_EARLY` (returned when `days_of_activity < PLACEMENT_PREDICTION_MIN_DAYS`), with body `{ "qualifying": false, "days_remaining": 12 }`.

---

## Verifiable Credential

### GET /credential/me
Return the student's current verifiable credential record.

**Response** (200):
```json
{
  "public_slug": "sharon-dave-7q3x",
  "public_url": "https://antarix.app/verify/sharon-dave-7q3x",
  "snapshot_overall_score": 95,
  "snapshot_taken_at": "2026-06-04T02:00:00Z",
  "last_verified_at": "2026-06-04T11:23:00Z",
  "verification_count": 14,
  "revocation_status": "active"
}
```

---

### POST /credential/refresh
Force a snapshot refresh. Idempotent; refreshes only if score has changed by the documented threshold.

**Response** (200): Updated credential object. `409 NO_CHANGE` if the snapshot is already current.

---

### POST /credential/distribution
Generate a PDF, QR code, or LinkedIn-badge artifact for the current snapshot.

**Request**:
```json
{ "channel": "pdf" }
```

**Response** (200):
```json
{
  "channel": "pdf",
  "artifact_url": "https://<storage>/credential/sharon-dave-7q3x.pdf",
  "expires_at": "2026-06-05T11:00:00Z"
}
```

---

### GET /verify/{slug}  *(public — no JWT)*
The student-facing public verification page, rendered as HTML for browsers and as JSON for API consumers.

**Query**: `Accept: application/json` returns:
```json
{
  "student": { "display_name": "Sharon Dave", "institution": "St. Joseph's Engineering College" },
  "overall_score": 95,
  "per_skill": [
    { "name": "Machine Learning", "proficiency": 87 },
    { "name": "Python", "proficiency": 89 }
  ],
  "verified_activity": {
    "tracked_hours": 687,
    "completed_projects": 42,
    "active_history_months": 12
  },
  "cohort_percentile": 95,
  "snapshot_taken_at": "2026-06-04T02:00:00Z",
  "current_score_delta": 0,
  "revocation_status": "active",
  "last_verified_at": "2026-06-04T11:23:00Z"
}
```

If `current_score_delta != 0`, the response includes `"disclosure": "Score has changed since last issuance"`.

---

## Student Applications

### POST /applications
One-click apply to a company. Attaches a credential snapshot at the moment of application.

**Request**:
```json
{ "company_id": "uuid" }
```

**Response** (201):
```json
{
  "application_id": "uuid",
  "credential_snapshot_id": "uuid",
  "status": "submitted",
  "applied_at": "2026-06-04T11:00:00Z"
}
```

**Errors**: `409 ALREADY_APPLIED`, `403 COMPANY_SEARCH_OPTED_OUT` (should not normally happen — recruiter-initiated, but guarded).

---

### GET /applications/me
List the student's application history.

**Response** (200):
```json
{
  "applications": [
    {
      "id": "uuid",
      "company": { "id": "uuid", "name": "Google" },
      "status": "interview_proposed",
      "applied_at": "2026-06-01T11:00:00Z",
      "credential_snapshot": { "overall_score": 95 }
    }
  ]
}
```

---

## Privacy & Source Management

### PUT /users/me/company-search-visibility
Toggle company-search visibility. Default true (opted-in); set to false to opt out.

**Request**:
```json
{ "visible": false }
```

**Response** (200):
```json
{
  "company_search_visible": false,
  "changed_at": "2026-06-04T11:00:00Z"
}
```

**Side effects**:
- A `privacy_requests` row is written.
- All pending recruiter-initiated `job_matches` for this user are marked `rejected` with reason `candidate_opted_out`.
- The candidate is removed from `candidate_profiles` index visibility (the row itself is retained for the user's own data export).

---

### DELETE /users/me
Request account deletion. Soft-delete; hard-purge after `PLACEMENT_PREDICTION_MIN_DAYS`-style documented window (target: 30 days).

**Response** (202):
```json
{
  "deletion_requested_at": "2026-06-04T11:00:00Z",
  "deletion_purge_after": "2026-07-04T11:00:00Z",
  "credential_invalidated_within_hours": 24
}
```

---

### DELETE /users/me/sources/{source}
Disconnect a single source. `source` ∈ `github | calendar | whatsapp`.

**Response** (200): Updated connection row with `status = 'disconnected'`.

---

## Extension Telemetry

### POST /extension/heartbeat
Called by the Chrome Extension every 15 minutes while running.

**Request**:
```json
{
  "extension_version": "1.2.0",
  "browser": "chrome"
}
```

**Response** (204): No body.

**Effect**: The ⚡ Power Mode badge freshness check uses the most recent heartbeat. If no heartbeat within `NUDGE_POWER_MODE_BADGE_FRESHNESS_HOURS`, the badge is removed on the next dashboard render.

---

## Interview Scheduling (calendar-aware)

### POST /job-matches/{id}/schedule
Generate proposed interview slots for an accepted job match.

**Request**:
```json
{
  "interviewer_user_ids": ["uuid"],
  "duration_minutes": 45,
  "window_start": "2026-06-10T00:00:00Z",
  "window_end": "2026-06-17T00:00:00Z"
}
```

**Response** (200):
```json
{
  "slots": [
    {
      "id": "uuid",
      "starts_at": "2026-06-12T13:30:00Z",
      "ends_at": "2026-06-12T14:15:00Z",
      "candidate_peak_window_match": true,
      "candidate_calendar_free": true,
      "interviewer_calendar_free": true
    }
  ]
}
```

**Slot-generation rules (documented)**:
- A slot is included only if `candidate_calendar_free = true` and **all** `interviewer_user_ids` have `interviewer_calendar_free = true`.
- Slots where `candidate_peak_window_match = true` are listed first.
- At least 3 slots are returned; if fewer than 3 are feasible, the response is `200` with fewer items and the `partial: true` flag.
