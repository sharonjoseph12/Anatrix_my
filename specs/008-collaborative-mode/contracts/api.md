# API Contracts: 008 — Collaborative Mode

**Date**: 2026-06-07
**Status**: Phase 1 design ratified

All endpoints are **internal** (Next.js API routes, Supabase-auth-gated, RLS-enforced) unless marked **public**. The Y.js + LiveKit init flows are documented in §"Client init flows" below.

---

## 1. Internal: Collab Room Lifecycle

### `POST /api/collab/rooms`
**Auth**: student / mentor / faculty / cohort-owner session.
**Body**:
```json
{
  "kind": "team",
  "cohort_id": "uuid",
  "scheduled_start": "2026-06-15T10:00:00Z",
  "duration_minutes": 60,
  "language": "javascript",
  "consent_required": true,
  "invited_user_ids": ["uuid", "uuid"]
}
```
**Response 201**:
```json
{
  "room_id": "uuid",
  "status": "scheduled",
  "kind": "team",
  "language": "javascript",
  "sandbox_kind": "webcontainer",
  "scheduled_start": "2026-06-15T10:00:00Z",
  "ends_at": "2026-06-15T11:00:00Z",
  "duration_minutes": 60,
  "invite_tokens": [
    { "user_id": "uuid", "join_token": "short-lived-jwt", "expires_at": "2026-06-15T11:05:00Z" }
  ]
}
```
**Errors**:
- `400` (`invalid_input`): duration out of range, invalid language, scheduled_start in past
- `403` (`forbidden`): non-cohort-owner trying to create cohort room
- `429` (`room_cap_exceeded`): cohort room cap reached (configurable, default 50 active)

**Side effects**:
- INSERT into `collab_rooms` (host row)
- INSERT one `collab_participants` row for the host with `role='host'`
- Generate per-invitee `join_token` (signed JWT, 1-hour TTL, single-use)
- Send in-app + email + Discord invite

---

### `GET /api/collab/rooms/{id}`
**Auth**: host, participant, or invited user (via `join_token`).
**Response 200**:
```json
{
  "room_id": "uuid",
  "kind": "team",
  "status": "live",
  "language": "javascript",
  "sandbox_kind": "webcontainer",
  "scheduled_start": "2026-06-15T10:00:00Z",
  "ends_at": "2026-06-15T11:00:00Z",
  "remaining_seconds": 1842,
  "host": { "user_id": "uuid", "first_name": "Ananya", "college": "IIT-B" },
  "participants": [
    { "user_id": "uuid", "role": "participant", "joined_at": "2026-06-15T10:00:12Z", "opt_out_teamwork": false }
  ],
  "consent_required": true
}
```
**Errors**: `404` (`room_not_found`), `403` (`forbidden`).

---

### `POST /api/collab/rooms/{id}/join`
**Auth**: student session; must hold a valid `join_token` in the request body (single-use).
**Body**:
```json
{
  "join_token": "short-lived-jwt"
}
```
**Response 200**:
```json
{
  "participant_id": "uuid",
  "role": "participant",
  "liveblocks": {
    "room_id": "uuid",
    "auth_token": "liveblocks-jwt",
    "ws_url": "wss://api.liveblocks.io/v2"
  },
  "livekit": {
    "room_name": "collab-uuid",
    "token": "livekit-jwt",
    "ws_url": "wss://antarix-collab-xxxxx.livekit.cloud",
    "can_publish": true,
    "can_subscribe": true
  },
  "sandbox": {
    "kind": "webcontainer",
    "boot_url": null,
    "ready_event": "sandbox.boot.ok"
  },
  "consent_required": true,
  "permissions": {
    "can_type": true,
    "can_run_tests": true,
    "can_voice": true,
    "can_chat": true
  }
}
```
**Errors**:
- `400` (`invalid_token`): bad signature, expired, or already-used
- `403` (`forbidden`): room full, room not joinable (status ≠ scheduled/live)
- `404` (`room_not_found`)

**Side effects**:
- UPSERT `collab_participants` (sets `joined_at`, `role`, `opt_out_teamwork` snapshot from `users.collab_opt_out`)
- INSERT `collab_events` row with `event_type='join'`
- INSERT `collab_audit` row with `action='observer_joined'` if role is observer

---

### `POST /api/collab/rooms/{id}/end`
**Auth**: host session OR service role (auto-end on timer).
**Body**:
```json
{
  "reason": "host_ended" | "timer_expired" | "all_left",
  "final_code": "base64-encoded-source"
}
```
**Response 200**:
```json
{
  "room_id": "uuid",
  "status": "ended",
  "artifact_id": "uuid",
  "scoring_queued": true,
  "scoring_eta": "2026-06-15T11:05:00Z"
}
```
**Errors**: `403` (`forbidden` if not host), `409` (`already_ended`).

**Side effects**:
- UPDATE `collab_rooms.status='ended'`, set `ends_at`
- UPDATE all open `collab_participants.left_at` + `left_reason`
- INSERT `collab_artifacts` row with `code_snapshot_url` (uploads `final_code` to Supabase Storage; signed URL persists 1 year)
- INSERT `collab_events` row with `event_type='leave'` for each active participant
- ENQUEUE `teamwork-scorer` edge function (async)
- INSERT `collab_audit` row with `action='sandbox_shutdown'`

---

### `GET /api/collab/rooms/{id}/teamwork`
**Auth**: participant in the room OR recruiter with `read:teamwork_score` consent.
**Response 200**:
```json
{
  "room_id": "uuid",
  "computed_at": "2026-06-15T11:03:42Z",
  "scores": [
    {
      "user_id": "uuid",
      "score": 78,
      "sub_scores": {
        "turn_taking": 82,
        "code_balance": 75,
        "conflict_resolution": 80,
        "help_events": 75
      },
      "breakdown": {
        "reasons": [
          "balanced_engagement: both authors active > 40% of window",
          "help_event: Ananya unblocked Priya at minute 18"
        ],
        "input_counts": {
          "code_commits_a": 24,
          "code_commits_b": 31,
          "chat_messages": 14,
          "test_runs": 6,
          "conflict_unresolved_events": 0
        }
      }
    },
    {
      "user_id": "uuid-2",
      "score": null,
      "opted_out": true
    }
  ],
  "room_score": 78,
  "skill_proof_contribution_cap_pct": 5
}
```
**Errors**: `404` (`room_not_found`), `403` (`forbidden` or `consent_required`), `425` (`scoring_pending` if scorer hasn't run yet).

---

## 2. Internal: Consent + Observer

### `POST /api/collab/rooms/{id}/consent`
**Auth**: participant in the room (the consent giver).
**Body**:
```json
{
  "grantee_user_id": "uuid",
  "scopes": ["observe_live", "observe_recorded", "read_teamwork_score"],
  "expires_at": "2026-06-15T12:00:00Z"
}
```
**Response 201**:
```json
{
  "consent_id": "uuid",
  "granted_at": "2026-06-15T10:05:00Z",
  "expires_at": "2026-06-15T12:00:00Z"
}
```
**Errors**:
- `400` (`invalid_input`): invalid scope, grantee not in room's allowed observers
- `403` (`forbidden`): not a participant
- `409` (`consent_already_active`): active consent exists; use DELETE then POST

**Side effects**:
- INSERT `collab_consents` row
- INSERT `collab_audit` row with `action='consent_granted'`
- Send notification to grantee

---

### `DELETE /api/collab/rooms/{id}/consent`
**Auth**: consent giver OR grantee (revoke) OR admin.
**Response 200**:
```json
{ "consent_id": "uuid", "revoked_at": "2026-06-15T10:42:00Z" }
```
**Side effects**:
- UPDATE `collab_consents.revoked_at = now()`
- INSERT `collab_audit` row with `action='consent_revoked'`
- INSERT `collab_events` row with `event_type='consent_revoked'`
- **Mid-session effect**: if the room is live and the grantee is currently observing, their Liveblocks + LiveKit tokens are revoked within 5 seconds (FR-024). A background job polls `collab_consents` and calls Liveblocks' auth API to downgrade the token.

---

### `POST /api/collab/rooms/{id}/observe`
**Auth**: user with active `collab_consents` row for this room (or via re-issued short-lived `observe_token`).
**Response 200**:
```json
{
  "observer_role": "recruiter_observer",
  "liveblocks": {
    "room_id": "uuid",
    "auth_token": "liveblocks-jwt-readonly",
    "ws_url": "wss://api.liveblocks.io/v2",
    "permission": "READ_ONLY"
  },
  "livekit": {
    "room_name": "collab-uuid",
    "token": "livekit-jwt-observer",
    "ws_url": "wss://antarix-collab-xxxxx.livekit.cloud",
    "can_publish": false,
    "can_subscribe": true
  },
  "recording_id": "uuid",
  "interview_mode": false
}
```
**Errors**: `403` (`consent_required`), `404` (`room_not_found`), `410` (`room_ended`).

**Side effects**:
- INSERT/UPSERT `collab_participants` with `role='recruiter_observer'`
- INSERT `collab_recordings` row with `started_at = now()`, `purge_after = now() + COLLAB_RECORDING_RETENTION_DAYS`
- INSERT `collab_audit` row with `action='observer_joined'`
- Send notification to all participants (FR-021)

---

## 3. Internal: Event Ingestion + Snapshots

### `POST /api/collab/rooms/{id}/events`
**Auth**: participant in the room.
**Body**: single event or batch:
```json
{
  "events": [
    {
      "event_type": "code_commit",
      "seq": 142,
      "payload": { "lines_added": 3, "lines_removed": 1, "file": "src/url.js" }
    },
    {
      "event_type": "test_run",
      "seq": 143,
      "payload": { "passed": 5, "failed": 1, "duration_ms": 1240 }
    }
  ]
}
```
**Response 202**:
```json
{ "accepted": 2, "highest_seq": 143 }
```
**Errors**: `409` (`seq_conflict`: a higher seq already exists; client should reconcile).
**Note**: This endpoint is the **server-side fallback** for event ingestion. The primary path is Liveblocks' ephemeral Y.js channel; this endpoint is the durable backing store.

---

### `POST /api/collab/rooms/{id}/snapshots`
**Auth**: participant in the room (typically the client or a server-side cron).
**Body**:
```json
{
  "seq_at_snapshot": 240,
  "yjs_update": "base64-encoded-yjs-binary",
  "client_id": "uuid"
}
```
**Response 201**:
```json
{ "snapshot_id": "uuid", "seq_at_snapshot": 240, "expires_at": "2026-06-20T10:00:00Z" }
```

### `GET /api/collab/rooms/{id}/snapshots/latest`
**Auth**: participant in the room.
**Response 200**:
```json
{
  "snapshot_id": "uuid",
  "seq_at_snapshot": 240,
  "yjs_update": "base64-encoded-yjs-binary",
  "created_at": "2026-06-15T10:55:00Z"
}
```

---

### `GET /api/collab/rooms/{id}/transcript`
**Auth**: participant in the room OR observer with `observe_recorded` scope.
**Response 200**:
```json
{
  "room_id": "uuid",
  "transcript": [
    { "user_id": "uuid", "first_name": "Ananya", "text": "Let's use a Set here", "sent_at": "2026-06-15T10:18:00Z" }
  ]
}
```

---

## 4. Recruiter Review

### `GET /api/collab/recruiter/reviews/{roomId}`
**Auth**: recruiter with valid `collab_consents` row OR participant in the room.
**Response 200**:
```json
{
  "room_id": "uuid",
  "language": "javascript",
  "duration_seconds": 3600,
  "code_snapshot_url": "https://...signed...",
  "transcript": [...],
  "terminal_scrollback": "[base64 of terminal capture, gzip-compressed]",
  "teamwork_score": 78,
  "per_student_contribution": [
    {
      "user_id": "uuid",
      "first_name": "Ananya",
      "code_lines_added": 142,
      "files_touched": 3,
      "chat_messages": 7,
      "test_runs_triggered": 2,
      "time_active_seconds": 3120
    }
  ],
  "consent_history": [
    { "action": "granted", "at": "2026-06-15T10:05:00Z" }
  ]
}
```

---

## 5. Settings

### `POST /api/settings/collab-opt-out`
**Auth**: any authenticated user.
**Body**:
```json
{ "collab_opt_out": true }
```
**Response 200**:
```json
{
  "user_id": "uuid",
  "collab_opt_out": true,
  "updated_at": "2026-06-15T09:00:00Z",
  "applies_to_future_sessions": true,
  "applies_retroactively": false
}
```
**Side effects**:
- UPDATE `users.collab_opt_out`
- INSERT `collab_audit` row with `action='opt_out_changed'`
- Effect propagates to next `POST /api/collab/rooms/{id}/join` (which snapshots the value into `collab_participants.opt_out_teamwork`)

---

## 6. Client init flows

### 6.1 Student / participant flow

```
[Client]                     [Next.js API]                [Liveblocks]    [LiveKit]            [Edge]
   |                                |                           |              |                    |
   |  GET /collab/room/{id}         |                           |              |                    |
   |------------------------------->|                           |              |                    |
   |  302 -> /collab/{id}/editor?join_token=...                 |              |                    |
   |<-------------------------------|                           |              |                    |
   |                                |                           |              |                    |
   |  POST /api/collab/rooms/{id}/join {join_token}              |              |                    |
   |------------------------------->|                           |              |                    |
   |                                | INSERT collab_participants, collab_events, collab_audit   |
   |                                |                           |              |                    |
   |<-------- {liveblocks, livekit, sandbox} --------------------|              |                    |
   |                                |                           |              |                    |
   |  Connect to Liveblocks (Y.js)  |                           |              |                    |
   |------------------------------------------------------>|     |              |                    |
   |  Connect to LiveKit (voice)    |                           |              |                    |
   |-------------------------------------------------------------->|              |                    |
   |  Boot WebContainer             |                           |              |                    |
   |  (browser-side)                |                           |              |                    |
   |                                |                           |              |                    |
   |  Edits flow over Liveblocks (Y.js CRDT)                    |              |                    |
   |------------------------------------------------------>|     |              |                    |
   |                                |                           |              |                    |
   |  Every 5min: POST /api/collab/rooms/{id}/snapshots         |              |                    |
   |------------------------------->|  store Y.js update        |              |                    |
   |                                |                           |              |                    |
   |  On end: POST /api/collab/rooms/{id}/end                    |              |                    |
   |------------------------------->|  finalize artifact, enqueue scorer        |                    |
   |                                |------------------------------------------------------>|       |
   |<-------- {artifact_id, scoring_eta} ----|                  |              |                    |
```

### 6.2 Recruiter observer flow

```
[Recruiter client]        [Next.js API]                    [Liveblocks]    [LiveKit]            [Participants]
   |                              |                              |              |                       |
   |  Click "Observe"             |                              |              |                       |
   |----------------------------->|                              |              |                       |
   |  POST /api/collab/rooms/{id}/observe                        |              |                       |
   |                              | Check collab_consents        |              |                       |
   |<----- {liveblocks READ_ONLY, livekit observer, recording_id}-|              |                       |
   |                              | INSERT collab_participants (recruiter_observer)                  |
   |                              | INSERT collab_recordings     |              |                       |
   |                              | INSERT collab_audit 'observer_joined'                              |
   |                              |----------------------------> |              |                       |
   |  Connect to Liveblocks (READ_ONLY permission)                |              |                       |
   |----------------------------------------------------->|       |              |                       |
   |  Connect to LiveKit (subscribe-only)                        |              |                       |
   |-------------------------------------------------------------->|              |                       |
   |                              |                              |              |  Notify participants|
   |                              |-------------------------------------------------->|                  |
   |  Optional: post problem (interview mode)                     |              |                       |
   |  POST /api/collab/rooms/{id}/interviewer-post-problem        |              |                       |
   |----------------------------->|  INSERT collab_events 'interviewer_posted_problem'               |
   |                              |  broadcast to participants via Liveblocks awareness channel     |
   |<-----------------------------|-------------------------------------------------->|                  |
   |                              |                              |              |                       |
   |  On end: GET /api/collab/recruiter/reviews/{id}              |              |                       |
   |----------------------------->|                              |              |                       |
   |<----- {code_snapshot, transcript, terminal, score, contributions} --------|                      |
```

### 6.3 Anti-collusion signal flow

```
[Client A]                [Next.js API]                [collab-typing-divergence edge]    [anticheat_signals]
   |                              |                                |                                |
   |  Request LLM coach hint      |                                |                                |
   |----------------------------->|                                |                                |
   |  POST /api/ai-coach/hint     |                                |                                |
   |                              |  Fetch last 60s of typing + commit cadence from collab_events     |
   |                              |------------------------------->|                                |
   |                              |  Compute divergence (a vs b)  |                                |
   |                              |<-- { divergence: 0.78, confidence: 0.78 } ------|                |
   |                              |                                                                |
   |                              |  If divergence >= 0.65: INSERT anticheat_signals --------------->|
   |                              |                                                                |
   |                              |  Return 403 if signal active  |                                |
   |<--- 403 { code: collab_divergence_signal_active } ---------|                                |
   |                              |  INSERT collab_events 'coach_blocked'                          |
```

### 6.4 Teamwork scoring flow

```
[collab-room-end]            [collab_artifacts]               [teamwork-scorer edge]            [teamwork_scores]
   |                                |                                |                                |
   |  POST /api/collab/rooms/{id}/end                                 |                                |
   |  final_code uploaded to Supabase Storage                         |                                |
   |  INSERT collab_artifacts                                         |                                |
   |                                |                                |                                |
   |  ENQUEUE teamwork-scorer ---------------------------------------->|                                |
   |                                |                                |                                |
   |                                |  Read collab_events for room   |                                |
   |                                |--------------------------------|                                |
   |                                |  Read collab_participants     |                                |
   |                                |--------------------------------|                                |
   |                                |  Compute 4 sub-scores (weighted)                              |
   |                                |  INSERT teamwork_scores (one per non-opted-out participant)---->|
   |                                |  Emit W3C VC for skill_proof_score (via 004 credential-vc-issue) |
   |                                |  INSERT collab_audit 'flag_raised' if conflict_unresolved events |
```

---

## 7. Error response shape (all endpoints)

```json
{
  "error": {
    "code": "rate_limited" | "invalid_input" | "not_found" | "forbidden" | "conflict" | "consent_required" | "room_cap_exceeded" | "internal_error" | "..." ,
    "message": "<human-readable>",
    "details": { ... }   // optional structured field hints
  }
}
```

## 8. Versioning

- All 008 endpoints are internal and unversioned (private to first-party clients).
- Breaking changes trigger a new path (`/api/collab/v2/...`); v1 supported for ≥ 6 months.
- The Liveblocks + LiveKit public APIs are vendor-managed; we pin SDK versions in `apps/web/package.json` and bump in a single PR.

## 9. Rate limits

- `POST /api/collab/rooms`: 10 req/min per user (prevents room-spam)
- `POST /api/collab/rooms/{id}/join`: 30 req/min per user (handles reconnect storms)
- `POST /api/collab/rooms/{id}/events`: 200 req/min per user per room (Y.js op batches are coalesced client-side; this is the durable backing store)
- `POST /api/collab/rooms/{id}/snapshots`: 1 req per `COLLAB_SNAPSHOT_INTERVAL_SECONDS` per room (5 min default)
- All endpoints respect the 004 public-API rate limit pattern (token bucket via `api_rate_counters` from 037).
