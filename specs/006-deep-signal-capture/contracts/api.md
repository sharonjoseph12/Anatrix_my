# API Contracts: 006 — Deep Signal Capture

**Date**: 2026-06-06
**Status**: Phase 1 design ratified

All endpoints are **internal** (Next.js API routes, auth-gated by Supabase RLS, except device-JWT for the IDE extension and HMAC for the mobile bridge). No public API is added in 006.

---

## Internal: IDE Telemetry

### `POST /api/ide-telemetry/session`
Body:
```json
{
  "device_id": "uuid",
  "started_at": "ISO8601",
  "ended_at": "ISO8601",
  "duration_seconds": 1800,
  "editor": "vscode",
  "project_hash": "sha256-hex-64",
  "language": "python",
  "keystroke_entropy_bpm": 3.42,
  "debug_session_duration_seconds": 120,
  "debug_step_ratio": 0.18,
  "ast_refactor_distance": 24,
  "time_in_file_seconds": 960,
  "test_run_count": 2,
  "error_resolution_latency_ms": 1840,
  "raw_partial_capture": false
}
```
Auth: device-scoped JWT in `Authorization: Bearer <jwt>` header. JWT is issued by the same endpoint (`POST /api/ide-telemetry/session` with `device_id` and `student_id` claims — first-time handshake). JWT TTL: 90 days, refreshed on every upload.

Response 201: `{ session_id: uuid, daily_aggregate_id: uuid, score_contribution_pct: number (0..3) }`
Side effects:
- INSERT `ide_sessions` row
- UPSERT `ide_aggregates` daily row
- INSERT `signal_audit` row (`provider='ide_vscode'` or `'ide_cursor'`, `action='upload'`, `byte_count`, `aggregate_hash`)
- Recompute the student's `score_contribution` capped at 3

Errors:
- 400 (validation: `duration_seconds` out of 60..1800, language not in supported set)
- 401 (device JWT expired or signature invalid)
- 403 (device_id already paired to a different `student_id`)
- 413 (payload > 2 KB)
- 429 (device-scoped rate limit: 60 uploads/hour/device)

### `DELETE /api/ide-telemetry/device/{device_id}`
Auth: student session (must own the `device_id`).
Response 200: `{ purged_session_count: int, purged_aggregate_count: int, audit_id: uuid }`
Side effects:
- INSERT `signal_audit` row (`action='delete_all'`, `provider='ide_vscode'` or `'ide_cursor'`)
- Queue all `ide_sessions` + `ide_aggregates` for the `device_id` for purge
- Revoke the device JWT

### `GET /api/ide-telemetry/sessions?limit=5&device_id=<uuid>`
Auth: student session.
Response 200: `{ sessions: Array<{ id, started_at, ended_at, duration_seconds, language }> }`
Used by the privacy center to show the last 5 aggregates.

---

## Internal: Biometric Integrations

### `GET /api/biometrics/connections`
Auth: student session.
Response 200:
```json
{
  "connections": [
    {
      "id": "uuid",
      "provider": "oura",
      "status": "connected",
      "last_sync_at": "ISO8601",
      "connected_at": "ISO8601",
      "scopes": ["sleep", "hrv", "resting_hr", "readiness"],
      "last_error": null
    }
  ]
}
```

### `POST /api/biometrics/connections`
Body: `{ provider: 'healthkit' | 'google_fit', scopes: string[] }`
Auth: student session.
Response 201: `{ connection_id: uuid, status: 'connected', scopes: string[] }`
Behaviour: Creates a `biometric_connections` row for a mobile-handled provider (HealthKit / Google Fit) without an OAuth round-trip. The mobile app follows up with a `POST /api/biometrics/mobile-sync` call carrying the daily aggregate. Used when the user has already granted scopes in the 005 Expo app and is registering the connection server-side. Writes a `signal_audit` row with `action='enable'`.
Errors: 400 (unknown provider for this path; Oura/Whoop must use `POST /api/biometrics/connect/{provider}`), 409 (connection already exists for this provider).

### `DELETE /api/biometrics/connections`
Auth: student session.
Response 200: `{ disconnected: Array<{ provider, connection_id, status: 'disconnected' }>, audit_id: uuid }`
Behaviour: Disconnects ALL of the student's biometric connections (HealthKit, Google Fit, Oura, Whoop) in one call. Used by the privacy center "Delete all and disconnect" action. Writes ONE `signal_audit` row with `action='delete_all'` (not one per provider) and queues all child `biometric_aggregates` and `peak_window_inferences` rows for the user's purge.

### `POST /api/biometrics/connect/{provider}` (start OAuth)
Path params: `provider` ∈ `oura|whoop`.
Auth: student session.
Response 302: redirect to provider's authorization URL (with PKCE state stored in an HTTP-only cookie).
Errors: 400 (unknown provider), 503 (provider unreachable).

### `GET /api/biometrics/connect/{provider}/callback?code=<code>&state=<state>`
Path params: `provider` ∈ `oura|whoop`.
Auth: public (the state cookie carries the student session).
Response 302: redirect to `/settings/signals?provider=<provider>&status=connected`.
Side effects:
- Exchange `code` for tokens
- Encrypt refresh token with pgsodium
- INSERT `biometric_connections` row
- INSERT `signal_audit` row (`action='enable'`, `provider='biometric_<provider>'`)

Errors:
- 400 (state mismatch → fail-closed)
- 401 (provider returned `invalid_grant`)
- 503 (provider unreachable)

### `POST /api/biometrics/disconnect/{provider}`
Path params: `provider` ∈ `healthkit|google_fit|oura|whoop`.
Auth: student session.
Response 200: `{ connection_id: uuid, status: 'disconnected' }`
Side effects:
- UPDATE `biometric_connections.status = 'disconnected'`
- INSERT `signal_audit` row (`action='disable'`)
- The existing `biometric_aggregates` rows are preserved (within 90-day TTL)

### `POST /api/biometrics/mobile-sync`
Body:
```json
{
  "provider": "healthkit",
  "day": "2026-06-06",
  "sleep_duration_minutes": 432,
  "sleep_quality_score": 78,
  "hrv_ms": 62,
  "resting_hr_bpm": 54,
  "daily_readiness_score": 81
}
```
Auth: device HMAC in `X-Antarix-Device-Signature: <hex-hmac-sha256>` header. The HMAC is computed by the 005 Expo app over (timestamp + body) with `BIOMETRIC_MOBILE_HMAC_SECRET`.
Response 201: `{ aggregate_id: uuid, score_contribution_pct: number (0..2) }`
Side effects:
- UPSERT `biometric_aggregates` daily row
- INSERT `signal_audit` row (`provider='biometric_healthkit'` or `'biometric_google_fit'`)

Errors:
- 400 (missing field, day in the future, day > 7 days old)
- 401 (HMAC mismatch)
- 409 (duplicate day for this device+provider)

---

## Internal: Privacy Center

### `GET /api/settings/signals`
Auth: student session.
Response 200:
```json
{
  "sources": [
    {
      "id": "uuid",
      "provider": "ide_vscode",
      "kind": "ide",
      "status": "connected",
      "connected_at": "ISO8601",
      "last_5_aggregates": [
        { "day": "2026-06-06", "session_count": 4, "total_active_seconds": 5400, "score_contribution_pct": 1.2 }
      ],
      "what_we_learned": "You tend to be most active on Python projects between 10am and 1pm, with a 1.2% contribution to your Skill Proof Score this week.",
      "toggle_url": "/api/settings/signals/ide_vscode"
    },
    {
      "id": "uuid",
      "provider": "oura",
      "kind": "biometric",
      "status": "connected",
      "last_5_aggregates": [
        { "day": "2026-06-06", "sleep_quality_score": 78, "score_contribution_pct": 0.4 }
      ],
      "what_we_learned": "Your HRV averaged 58ms over the last 7 days. We use this to sharpen your peak-window confidence from 0.6 to 0.72.",
      "toggle_url": "/api/settings/signals/oura"
    },
    {
      "id": "uuid",
      "provider": "healthkit",
      "kind": "biometric",
      "status": "disconnected",
      "connected_at": null,
      "last_5_aggregates": [],
      "what_we_learned": null,
      "toggle_url": "/api/settings/signals/healthkit"
    }
  ],
  "total_score_cap_pct": 5
}
```

### `DELETE /api/settings/signals/{source}`
Path params: `source` ∈ `ide_vscode|ide_cursor|biometric_healthkit|biometric_google_fit|biometric_oura|biometric_whoop`.
Auth: student session.
Response 200: `{ source, status: 'disconnected', queued_purge_count: int, audit_id: uuid }`
Side effects:
- UPDATE `biometric_connections.status = 'disconnected'` (or equivalent for IDE device)
- INSERT `signal_audit` row (`action='delete_one'` or `'delete_all'` if "Delete all" was clicked)
- Queue rows for nightly purge

### `POST /api/settings/signals/delete-all`
Auth: student session.
Response 200: `{ queued_purge_counts: { ide_sessions: int, ide_aggregates: int, biometric_connections: int, biometric_aggregates: int, peak_window_inferences: int }, audit_id: uuid }`
Side effects: Same as DELETE on every source, plus a single `signal_audit` row with `action='delete_all'`.

### `GET /api/settings/signals/dpdp-erasure`
Auth: student session.
Response 200: `{ requests: Array<{ id: uuid, requested_at: ISO8601, status: 'pending' | 'complete' | 'failed', completed_at: ISO8601|null }> }`
Used by the privacy center to show in-flight DPDP requests.

### `POST /api/settings/signals/dpdp-erasure`
Auth: student session.
Response 201: `{ request_id: uuid, estimated_completion: ISO8601 }`
Side effect: Reuses the existing `privacy-request-deletion` edge function from 001. A `signal_audit` row is written with `action='erasure_complete'` when the job finishes.

---

## Internal: Admin Audit

### `GET /api/admin/audit/{student_id}?limit=50&cursor=<bigserial>`
Auth: `admin` or `college_admin` session (with `audit:read` scope on the student).
Response 200:
```json
{
  "rows": [
    {
      "id": 12345,
      "actor_id": "uuid-or-pseudonym",
      "actor_type": "student",
      "student_id": "uuid",
      "provider": "ide_vscode",
      "action": "upload",
      "byte_count": 412,
      "aggregate_hash": "sha256-hex-64",
      "created_at": "ISO8601"
    }
  ],
  "next_cursor": 12346
}
```
The `payload_redacted` field is always `true` and is not exposed in the response. The `aggregate_hash` is exposed for forensic chaining; the underlying payload is not.

Errors:
- 401 (no session)
- 403 (no `audit:read` scope on the student — college admin can only read their own institution's students)
- 404 (student not found)

---

## Webhook (incoming): Mobile bridge health check

### `GET /api/biometrics/mobile-sync/health`
Auth: device HMAC.
Response 200: `{ ok: true, server_time: ISO8601, accepted_provider_versions: ['1.0.0'] }`
Used by the 005 Expo app on launch to verify the server endpoint is reachable before the first post.

---

## Error response shape (all endpoints)

```json
{
  "error": {
    "code": "rate_limited" | "invalid_input" | "not_found" | "forbidden" | "conflict" | "unauthorized" | "internal_error" | "dpdp_window_active",
    "message": "<human-readable>",
    "details": { ... }
  }
}
```

The `dpdp_window_active` code is returned when a user requests a "Delete all" action while a DPDP erasure is already in flight (the second request is a no-op + the user is told the statutory window).

---

## Score cap enforcement

The 3% IDE and 2% biometric caps are enforced server-side at the score aggregator. The `ide_aggregates.score_contribution` column is `CHECK (score_contribution <= 3)` and the `biometric_aggregates.score_contribution` column is `CHECK (score_contribution <= 2)`. The cap is the max, not a sum — a user with both IDE and biometrics can contribute up to 5 percentage points combined.

The client receives the actual `score_contribution_pct` in every API response that produces a score-affecting write. The client NEVER receives an uncapped value.

---

## Versioning

- All 006 endpoints are unversioned (internal, first-party clients only).
- A breaking change to the IDE extension API requires a `x-api-version` header bump in the extension's JWT; old extensions get a 401 + a forced re-handshake.
- A breaking change to the mobile-sync HMAC requires a coordinated app release; the previous version is supported for 90 days after the new one ships.
