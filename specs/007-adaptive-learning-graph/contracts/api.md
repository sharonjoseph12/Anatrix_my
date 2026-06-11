# API Contracts: Adaptive Learning Graph

**Date**: 2026-06-06
**Status**: Phase 1 design ratified

All routes are Next.js 15 App Router API routes, Supabase-auth-gated (session cookie or service-role key), RLS-enforced. 6 internal surfaces, all behind feature flags.

---

## Mentors

### `GET /api/mentors`

Returns the top 5 alumni matches for the calling student.

**Auth**: student session.
**Query params** (all optional):
- `target_company` (string) — override the student's default target-company tag
- `top_k` (int, default 5, max 10)

**Response 200**:
```json
{
  "matches": [
    {
      "alumnus_id": "uuid",
      "alumnus_user_id": "uuid",
      "current_employer": "Razorpay",
      "current_role": "Backend Engineer II",
      "specialty_tags": ["backend", "system-design", "go"],
      "rating_avg": 4.6,
      "sessions_count": 27,
      "cosine_similarity": 0.913,
      "career_stage": "mid",
      "target_company_match": true,
      "next_slots": [
        { "slot_id": "uuid", "start_at": "2026-06-10T19:00:00+05:30", "end_at": "2026-06-10T19:30:00+05:30" }
      ]
    }
  ]
}
```

**Errors**:
- 401 (no session)
- 404 (student has no `skill_trajectory_embeddings` row — first-run, prompt to wait for next nightly cron)

---

### `POST /api/mentors/{id}/request`

Creates a `mentor_requests` row and transitions the slot from `open` to `held`.

**Auth**: student session.
**Body**:
```json
{
  "slot_id": "uuid",
  "intro_text": "string (10..200 chars)"
}
```

**Response 201**:
```json
{
  "request_id": "uuid",
  "status": "pending",
  "slot_id": "uuid",
  "hold_expires_at": "2026-06-06T14:32:00Z"
}
```

**Errors**:
- 400 (intro_text length, slot not in `open` status, slot in the past)
- 404 (alumnus or slot not found)
- 409 (slot already held by another request; retry on slot release)

**Side effects**:
- Slot transitions to `held` with `hold_expires_at = now() + 15 minutes`
- Cron `mentor-hold-release` (every 5 min) sweeps held slots whose `hold_expires_at < now()` back to `open`

---

### `POST /api/mentor-requests/{id}/respond`

Alumnus accepts or declines a pending request.

**Auth**: alumnus session (must own the alumnus_id on the request).
**Body**:
```json
{ "decision": "accept" | "decline" }
```

**Response 200** (on accept):
```json
{
  "request_id": "uuid",
  "status": "accepted",
  "session_id": "uuid",
  "video_room": {
    "provider": "livekit",
    "join_url": "https://...",
    "host_token": "..."
  },
  "calendar_event_id": "uuid"
}
```

**Response 200** (on decline):
```json
{
  "request_id": "uuid",
  "status": "declined"
}
```

**Errors**:
- 401 / 403 (not the alumnus on the request)
- 404 (request not found, or already responded to)
- 410 (request expired)
- 502 (video room creation failed; the edge function retries 3x then 502s)

**Side effects (on accept)**:
- `mentor_requests.status` → `accepted`, `responded_at` set
- `mentor_sessions` row created with `video_provider` + `video_room_join_url` + `video_room_metadata`
- `mentor_availability_slots.status` → `booked`, `mentor_request_id` set
- `calendar_events` row (002) inserted for both student and alumnus (tagged `mentor_session`)
- Nudge-inbox (003) row for both parties with the join URL

**Side effects (on decline)**:
- `mentor_requests.status` → `declined`
- `mentor_availability_slots.status` → `open` (slot freed)
- Alumnus is shown a one-line nudge suggesting they expand availability if `decline_count_30d > 5`

---

## Curriculum

### `GET /api/curriculum/today`

Returns the calling student's lessons scheduled for today (or `?date=YYYY-MM-DD`).

**Auth**: student session.
**Query params** (all optional):
- `date` (YYYY-MM-DD) — default: today (student local time, derived from `users.timezone`)

**Response 200**:
```json
{
  "date": "2026-06-06",
  "lessons": [
    {
      "lesson_id": "uuid",
      "topic": "Closures in JavaScript",
      "sub_topic": "Currying",
      "concept_explainer": "...",
      "exercise": { "problem_statement": "...", "starter_code": "...", "language": "python" },
      "reflection_question": "...",
      "alumnus_reference": { "alumnus_id": "uuid", "commit_or_project_url": "...", "why_relevant": "..." },
      "difficulty": 3,
      "scheduled_for": "2026-06-06T19:00:00+05:30",
      "calendar_event_id": "uuid",
      "status": "scheduled",
      "mentor_id": null,
      "generation_source": "llm",
      "feedback": null
    }
  ]
}
```

**Errors**:
- 401 (no session)
- 404 (no lessons for the requested date)

---

### `POST /api/curriculum/lessons/{id}/feedback`

Records a student's feedback on a specific lesson.

**Auth**: student session (must own the lesson).
**Body**:
```json
{
  "rating": "too_easy" | "too_hard" | "not_relevant" | "just_right",
  "free_text": "string (≤ 500 chars, optional)"
}
```

**Response 201**:
```json
{
  "feedback_id": "uuid",
  "next_difficulty": 4,    // recalibrated (only changes if same-topic prior feedback exists)
  "downweighted_until": null
}
```

**Side effects**:
- `lesson_feedback` row inserted
- `curriculum_lessons.difficulty` updated only if this is the *first* feedback on the lesson; subsequent feedback does not change the lesson (it only feeds the calibrator for the *next* lesson on the same topic)
- If `rating = 'not_relevant'`, the `lesson_feedback-calibrator` sets a 7-day downweight on the sub_topic in the recommender
- The struggle detector (US3) checks: if this feedback brings the count of `too_hard`/`not_relevant` on the same topic to ≥ 2 within 14 days, queues a mentor-suggestion nudge

**Errors**:
- 400 (rating enum, free_text length)
- 404 (lesson not found / not owned)
- 409 (feedback already exists for this lesson; PATCH instead)

---

### `POST /api/curriculum/lessons/{id}/complete`

Marks a lesson as completed by the student.

**Auth**: student session (must own the lesson).
**Body**:
```json
{ "duration_seconds": 720 }   // optional, observed by the client
```

**Response 200**:
```json
{
  "lesson_id": "uuid",
  "status": "completed",
  "completed_at": "2026-06-06T20:15:00Z",
  "streak_updated": true
}
```

**Side effects**:
- `curriculum_lessons.status` → `completed`, `completed_at` set
- If no completion is recorded within 48h of `scheduled_for`, the nightly `lesson-abandon-detect` job flips the status to `abandoned` and the struggle detector considers it as a negative signal
- Nudge-inbox (003) row may be created the next morning to congratulate streak milestones

**Errors**:
- 400 (lesson already completed)
- 404 (lesson not found / not owned)

---

## Alumni (out-of-band config)

### `POST /api/alumni/opt-in`

Alumnus opts in / out and sets their mentor profile.

**Auth**: alumnus session.
**Body**:
```json
{
  "opt_in": true,
  "current_employer": "Razorpay",
  "current_role": "Backend Engineer II",
  "target_company_tags": ["Razorpay", "Stripe"],
  "specialty_tags": ["backend", "system-design", "go"],
  "career_stage": "student" | "junior" | "mid" | "senior" | "staff" | "unknown",
  "weekly_template": [
    { "day": "Wed", "start_local": "19:00", "end_local": "21:00", "tz": "Asia/Kolkata" }
  ]
}
```

**Response 200**:
```json
{
  "alumni_profile_id": "uuid",
  "opt_in": true,
  "slots_materialized": 8,
  "materialized_window_weeks": 4
}
```

**Side effects**:
- `alumni_profiles` row upserted
- If `opt_in` flipped false, all `open` and `held` slots for the alumnus are deleted; pending `mentor_requests` are auto-declined with reason `alumnus_opted_out`
- If `opt_in = true` and a `weekly_template` is provided, the next 4 weeks of `mentor_availability_slots` are materialized
- Triggers `embedding-rebuild` for the alumnus (async)

**Errors**:
- 400 (validation; e.g. specialty_tags > 10)
- 401 (no session)

---

### `POST /api/students/{id}/embedding` (admin / cron triggered)

Re-builds a single user's trajectory embedding on demand.

**Auth**: service role only (no end-user access).
**Body**:
```json
{
  "reason": "manual" | "anti_cheat" | "score_delta"   // optional, audit
}
```

**Response 200**:
```json
{
  "user_id": "uuid",
  "embedding_id": "uuid",
  "trajectory_event_count": 47,
  "model_version": "minilm-l6-v2@1"
}
```

**Errors**:
- 401 (not service role)
- 404 (user not found)
- 503 (embedding inference service unreachable; retry)

---

## Error response shape (all endpoints)

```json
{
  "error": {
    "code": "rate_limited" | "invalid_input" | "not_found" | "forbidden" | "conflict" | "internal_error" | "video_provider_unavailable" | "llm_cost_cap_exceeded",
    "message": "<human-readable>",
    "details": { }
  }
}
```

---

## Internal: not-externally-callable

These are edge functions or cron jobs, not API routes. Documented here for traceability:

- `embedding-rebuild` (cron, nightly) — full-pass rebuild of all active student + opted-in alumnus embeddings
- `mentor-match` (called by `GET /api/mentors`) — returns ranked match list
- `curriculum-generate-daily` (cron, nightly at `CURRICULUM_CRON_HOUR_LOCAL`) — 3 lessons per active student
- `video-room-create` (called by `POST /api/mentor-requests/{id}/respond` on accept) — LiveKit or Google Meet
- `mentor-hold-release` (cron, every 5 min) — releases expired `held` slots back to `open`
- `lesson-abandon-detect` (cron, nightly) — flips unfinished lessons to `abandoned` after 48h
- `struggle-detect` (cron, every 6h) — emits mentor-suggestion nudges
