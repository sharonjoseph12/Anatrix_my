# API Contracts: 010 — AI Talent Twin

**Date**: 2026-06-08
**Status**: Phase 1 design ratified

All endpoints are **internal** (Next.js API routes, Supabase-auth-gated, RLS-enforced) unless marked **public**. The authorship proof verification endpoint is public (no auth required).

---

## 1. Internal: Recruiter Talent Twin

### `POST /api/v1/recruiters/talent-twin/ask`

**Auth**: recruiter session (must have `role = 'recruiter'`).

**Body**:
```json
{
  "student_id": "uuid",
  "question": "What projects has this student worked on?",
  "session_id": "uuid (optional — null creates new session)"
}
```

**Response 201** (student has opted in):
```json
{
  "session_id": "uuid",
  "answer_id": "uuid",
  "status": "pending",
  "message": "Your question has been submitted. The student will review it before the answer is visible."
}
```

**Response 201** (student has auto-approve enabled or answer was pre-approved):
```json
{
  "session_id": "uuid",
  "answer_id": "uuid",
  "status": "approved",
  "answer": "Based on their Antarix work, I can see... [Source: GitHub PR — Refactor auth middleware](https://...)",
  "citations": [
    { "source_type": "github_pr", "title": "Refactor auth middleware", "url": "https://..." },
    { "source_type": "mock_interview", "title": "System Design Interview", "url": "https://..." }
  ]
}
```

**Errors**:
- `400` (`invalid_input`): question too long (> 1000 chars), student_id missing
- `403` (`student_not_opted_in`): student has not enabled talent twin
- `403` (`recruiter_not_authorized`): recruiter's partner company is not approved
- `404` (`student_not_found`)
- `429` (`token_cap_reached`): recruiter exceeded `TALENT_TWIN_WEEKLY_TOKEN_CAP`
- `503` (`rag_unavailable`): embedding service or LLM provider is down

**Side effects**:
- INSERT or UPDATE `recruiter_chat_session` (increment `question_count`)
- INSERT `answer_preview` row with status `'pending'`
- INSERT `talent_twin_qa_log` row with `question_hash`, `status='pending'`
- If student has auto-approve setting enabled (or `TALENT_TWIN_AUTO_APPROVE_HOURS` = 0), the answer is approved immediately and the recruiter receives the answer in the response

---

### `GET /api/v1/recruiters/talent-twin/sessions/{id}`

**Auth**: recruiter session (must own the session).

**Response 200**:
```json
{
  "session_id": "uuid",
  "student_id": "uuid",
  "student_name": "Priya Sharma",
  "started_at": "2026-06-08T10:00:00Z",
  "last_activity_at": "2026-06-08T10:15:00Z",
  "question_count": 3,
  "questions": [
    {
      "answer_id": "uuid",
      "question": "What projects has this student worked on?",
      "status": "approved",
      "answer": "...",
      "citations": [...],
      "answered_at": "2026-06-08T10:01:00Z"
    },
    {
      "answer_id": "uuid",
      "question": "Describe their debugging approach",
      "status": "pending",
      "answer": null,
      "citations": null,
      "answered_at": null
    }
  ]
}
```

**Errors**: `404` (`session_not_found`), `403` (`forbidden`).

---

## 2. Internal: Student Talent Twin

### `GET /api/v1/students/talent-twin/pending`

**Auth**: student session.

**Response 200**:
```json
{
  "pending_count": 2,
  "pending_answers": [
    {
      "id": "uuid",
      "recruiter_name": "Rahul from TechCorp",
      "question": "What projects has this student worked on?",
      "generated_answer": "Based on their Antarix work...",
      "citations": [...],
      "created_at": "2026-06-08T10:00:00Z",
      "auto_approve_at": "2026-06-09T10:00:00Z"
    }
  ]
}
```

**Errors**: `401` (no session).

---

### `POST /api/v1/students/talent-twin/answers/{id}/approve`

**Auth**: student session (must be the subject of the answer).

**Body**: (empty)

**Response 200**:
```json
{
  "id": "uuid",
  "status": "approved",
  "approved_at": "2026-06-08T10:30:00Z"
}
```

**Side effects**:
- UPDATE `answer_preview.status = 'approved'`, set `approved_at`
- COPY citation_links to `talent_twin_qa_log` for the matching row
- DELETE the `answer_preview` row (cleanup after copy)
- The recruiter's next session poll will show the answer

**Errors**: `404` (`answer_not_found`), `403` (`forbidden`), `409` (`already_processed`).

---

### `POST /api/v1/students/talent-twin/answers/{id}/reject`

**Auth**: student session (must be the subject of the answer).

**Body** (optional):
```json
{
  "edited_answer": "I actually led the auth refactor, not just participated. The key challenge was..."
}
```

**Response 200**:
```json
{
  "id": "uuid",
  "status": "rejected",
  "edited_version_provided": true,
  "rejected_at": "2026-06-08T10:35:00Z"
}
```

**Side effects**:
- UPDATE `answer_preview.status = 'rejected'`, set `rejected_at`
- If `edited_answer` provided: set `answer_preview.edited_answer`, copy edited version to recruiter view
- DELETE the `answer_preview` row (cleanup after action)
- The recruiter sees either the edited answer or "Question declined by student"

**Errors**: same as approve.

---

### `POST /api/v1/students/talent-twin/opt-in`

**Auth**: student session.

**Body**:
```json
{
  "enabled": true
}
```

**Response 200**:
```json
{
  "status": "opted_in",
  "updated_at": "2026-06-08T09:00:00Z",
  "message": "Recruiters can now ask questions about your work. You can preview every answer before it's visible."
}
```

**Body** (revoke):
```json
{
  "enabled": false
}
```

**Response 200**:
```json
{
  "status": "opted_out",
  "updated_at": "2026-06-08T09:05:00Z",
  "message": "Talent Twin access revoked. All Q&A logs have been anonymized within 60 seconds.",
  "purge_eta_seconds": 60
}
```

**Errors**: `400` (invalid `enabled` value).

**Side effects (enable)**:
- UPDATE `users.talent_twin_opted_in = true`
- Queue embedding job for this student (async)

**Side effects (disable)**:
- UPDATE `users.talent_twin_opted_in = false`
- UPDATE `talent_twin_qa_log.status = 'revoked'` for all rows with `student_id = me`
- DELETE all `answer_preview` rows for `student_id = me`
- DELETE all `recruiter_chat_session` rows for `student_id = me`
- Trigger deletion of all embedding chunks for `student_id = me`
- INSERT `signal_audit` row with `action = 'talent_twin_revoked'`

---

## 3. Internal: Authorship Proof

### `POST /api/v1/students/authorship-proof/request`

**Auth**: student session.

**Body**:
```json
{
  "project_id": "uuid",
  "language": "typescript"
}
```

**Response 201**:
```json
{
  "proof_id": "uuid",
  "status": "requested",
  "sandbox_session_url": "/projects/<project-id>/authorship-proof/<proof-id>",
  "message": "Open the sandboxed editor and write code for 5-15 minutes to generate your authorship proof."
}
```

**Errors**:
- `400` (`insufficient_baseline`): < 30 days or < 1000 keystroke events in 006 IDE telemetry
- `400` (`duplicate_request`): active proof already exists for this project
- `400` (`project_not_found`)
- `403` (`feature_disabled`): `010_authorship_proof` flag is OFF

**Side effects**:
- INSERT `authorship_proof` row with `status='requested'`
- Create sandbox session URL (reuses 008's code sandbox)

---

### `POST /api/v1/students/authorship-proof/{id}/complete-session`

**Auth**: student session.

**Body**:
```json
{
  "keystroke_timing_vector": {
    "bins": ["50-100","100-150","150-200","200-250","250-300","300-350","350-400","400-450","450-500"],
    "counts": [42, 78, 55, 32, 18, 9, 4, 2, 1, 0]
  },
  "ast_diff_sequence": [
    { "nodes_added": 12, "nodes_removed": 3, "max_depth_delta": 1 },
    { "nodes_added": 8, "nodes_removed": 5, "max_depth_delta": 2 }
  ],
  "error_recovery_vector": {
    "count": 2,
    "latencies_ms": [3200, 5400],
    "mean_latency_ms": 4300,
    "median_latency_ms": 4300
  },
  "duration_seconds": 480,
  "keystroke_count": 221,
  "language": "typescript"
}
```

**Response 200**:
```json
{
  "proof_id": "uuid",
  "status": "completed",
  "confidence_score": 87,
  "baseline_similarity": 0.88,
  "verifiable_credential_url": "https://credentials.antarix.com/vc/proof-uuid",
  "message": "Your code authorship has been verified with 87% confidence. The badge is now visible to employers."
}
```

**Response 200** (insufficient similarity):
```json
{
  "proof_id": "uuid",
  "status": "failed",
  "confidence_score": 42,
  "baseline_similarity": 0.55,
  "message": "Confidence too low (42/100). Try writing for longer or in a familiar environment.",
  "retries_remaining": 2
}
```

**Errors**:
- `400` (`insufficient_keystrokes`): `keystroke_count < AUTHORSHIP_MIN_KEYSTROKE_EVENTS`
- `400` (`session_too_short`): `duration_seconds < AUTHORSHIP_MIN_SESSION_SECONDS`
- `404` (`proof_not_found`), `403` (`forbidden`), `409` (`already_completed`)

**Side effects**:
- INSERT `authorship_sandbox_sessions` row
- Compute baseline similarity against 006 IDE telemetry
- If similarity ≥ `AUTHORSHIP_SIMILARITY_THRESHOLD` (0.7): mint W3C VC via 004 credential-issue flow, update `authorship_proof` with `status='completed'`, `confidence_score`, `verifiable_credential_url`
- If similarity < threshold: update `authorship_proof` with `status='failed'`, increment retry count

---

### `GET /api/v1/students/authorship-proof/{id}/badge`

**Auth**: student session (or employer with view access to the project).

**Response 200**:
```json
{
  "proof_id": "uuid",
  "status": "completed",
  "confidence_score": 87,
  "project_id": "uuid",
  "language": "typescript",
  "session_date": "2026-06-08T10:45:00Z",
  "session_duration_seconds": 480,
  "verifiable_credential_url": "https://credentials.antarix.com/vc/proof-uuid",
  "credential_status": "valid"
}
```

**Errors**: `404` (`proof_not_found`), `403` (`forbidden`).

---

## 4. Public: Authorship Proof Verification

### `GET /api/v1/public/authorship-proof/{id}/verify`

**Auth**: none (public).

**Response 200**:
```json
{
  "proof_id": "uuid",
  "credential_status": "valid",
  "confidence_score": 87,
  "issued_at": "2026-06-08T10:50:00Z",
  "student_name": "Priya Sharma",
  "college": "NIT Trichy",
  "project_title": "Real-time Chat Application",
  "language": "typescript",
  "verifiable_credential": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "VerifiedOriginalWork"],
    "issuer": "did:antarix:issuer",
    "issuanceDate": "2026-06-08T10:50:00Z",
    "credentialSubject": {
      "id": "did:antarix:student-uuid",
      "claim": "VerifiedOriginalWork",
      "confidence_score": 87,
      "project": "Real-time Chat Application"
    }
  }
}
```

**Response 200** (revoked):
```json
{
  "proof_id": "uuid",
  "credential_status": "revoked",
  "revoked_at": "2026-06-09T09:00:00Z"
}
```

**Errors**: `404` (proof not found or not completed).

---

## 5. Error response shape (all endpoints)

```json
{
  "error": {
    "code": "student_not_opted_in" | "insufficient_baseline" | "recruiter_not_authorized"
          | "token_cap_reached" | "rag_unavailable" | "invalid_input" | "not_found"
          | "forbidden" | "conflict" | "already_processed" | "duplicate_request"
          | "insufficient_keystrokes" | "session_too_short" | "already_completed"
          | "feature_disabled" | "internal_error",
    "message": "<human-readable>",
    "details": { ... }
  }
}
```

## 6. Rate limits

- `POST /api/v1/recruiters/talent-twin/ask`: 30 req/min per recruiter (prevents abusive Q&A volume)
- `GET /api/v1/students/talent-twin/pending`: 60 req/min per student
- `POST /api/v1/students/talent-twin/answers/{id}/approve`: 30 req/min per student
- `POST /api/v1/students/talent-twin/answers/{id}/reject`: 30 req/min per student
- `POST /api/v1/students/talent-twin/opt-in`: 5 req/min per student (prevents rapid toggling)
- `POST /api/v1/students/authorship-proof/request`: 3 req/day per student (prevents abuse)
- `POST /api/v1/students/authorship-proof/{id}/complete-session`: 10 req/min per student
- `GET /api/v1/public/authorship-proof/{id}/verify`: 100 req/min per IP

## 7. Versioning

- All endpoints are versioned under `/api/v1/`.
- A breaking change to the RAG pipeline (e.g. new LLM provider, changed prompt template) does not require a new API version if the request/response contract is unchanged.
- A breaking change to the authorship proof vector schema (e.g. new vector dimensions) increments the session payload contract version; old sessions are grandfathered.
