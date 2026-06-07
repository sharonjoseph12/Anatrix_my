# API Contracts: 11/10 — Defensible Moat

**Date**: 2026-06-06
**Status**: Phase 1 design ratified

Two API surfaces: **internal** (Next.js API routes, Supabase-auth-gated, RLS-enforced) and **public** (`/v1/public/*`, API-key authenticated, rate-limited).

---

## Internal: Anti-cheat

### `POST /api/anticheat/appeal`
Body: `{ signal_id: uuid, explanation: string (min 30), evidence_url?: string }`
Auth: student session.
Response 201: `{ appeal_id: uuid, status: 'pending' }`
Errors: 400 (validation), 404 (signal not found / not owned), 409 (already appealed and pending).

### `POST /api/anticheat/decide`
Body: `{ appeal_id: uuid, decision: 'approved' | 'rejected', mentor_note?: string }`
Auth: faculty/mentor session at same institution as student.
Response 200: `{ appeal_id, status, decided_at }`
Side effects: if `approved` → unquarantine repo + trigger score recompute; if `rejected` → quarantine remains; audit row written in both cases.

---

## Internal: ATS

### `POST /api/ats/connect`
Body: `{ provider: 'greenhouse' | 'lever', api_key: string, pool_id?: string }`
Auth: recruiter session.
Response 201: `{ connection_id: uuid, status: 'active' }`
Behavior: API key encrypted via pgsodium before persistence; a test ping is fired immediately; on failure, status `'paused'` with error reason in response.

### `DELETE /api/ats/connect/:id`
Auth: recruiter session (owner only).
Response 204.

### `POST /api/ats/saved-search`
Body: `{ connection_id: uuid, name: string, query_json: object, min_score?: int }`
Auth: recruiter session.
Response 201: `{ saved_search_id: uuid }`

### Cron: `ats-sync-evaluator` (every 5 min)
Walks every `active` saved search, evaluates against the candidate index, enqueues `ats-sync-{provider}` for each new match. Not externally callable.

---

## Internal: SSO (WorkOS)

### `GET /api/sso/workos/login?institution_slug=<slug>`
Public route (no auth required).
Behavior: looks up `sso_connections` for institution → WorkOS authorization URL → 302 redirect.
Errors: 404 (unknown slug), 503 (WorkOS unreachable).

### `GET /api/sso/workos/callback?code=<code>&state=<state>`
Public route.
Behavior: exchanges code via WorkOS SDK → maps `role` attribute → upserts user → creates Supabase session → 302 redirect to portal dashboard.
Errors: 400 (invalid code), 401 (role attribute missing → fail-closed), 503 (WorkOS unreachable).

---

## Internal: Faculty

### `POST /api/faculty/verify`
Body: `{ user_id: uuid, institution_id: uuid }`
Auth: institution admin session.
Response 201: `{ verification_id, verified: true }`
Side effect: row in `faculty_verifications`.

### `POST /api/faculty/grade`
Body: `{ student_id: uuid, assignment_id: uuid, grade: int (0-100), comment?: string }`
Auth: faculty session (must have verified `faculty_verifications.verified=true`).
Response 201: `{ grade_id: uuid, recompute_eta: ISO8601 }`
Errors: 403 (not a verified faculty at student's institution), 422 (duplicate grade — use amendment endpoint).

---

## Internal: Hackathons

### `POST /api/hackathons`
Body: `{ title, problem, test_cases_url, starts_at, ends_at, prize_structure }`
Auth: recruiter session.
Response 201: `{ hackathon_id, status: 'draft' }`
Validation: window 24-168h; `test_cases_url` must be a signed Supabase storage URL.

### `POST /api/hackathons/:id/publish`
Auth: recruiter session (owner).
Response 200: `{ status: 'live' }`

### `POST /api/hackathons/:id/submissions`
Body: `{ code_url, language }`
Auth: student session.
Response 202: `{ submission_id, status: 'pending_grade' }`
Side effect: enqueues `hackathon-grader` edge function (which runs the sandbox).

### `GET /api/hackathons/:id/leaderboard`
Auth: any authenticated user.
Response 200: `{ leaderboard: [{ rank, student_id (or 'anonymous'), score }] }`
Notes: shows anonymized rows for opted-out students per privacy contract.

---

## Internal: Mock Interview

### `POST /api/mock-interview/start`
Body: `{ topic: string }`
Auth: student session.
Response 201: `{ interview_id, first_question }`
Pre-check: weekly cap not exceeded; if exceeded, returns 429 with `Retry-After` header.

### `POST /api/mock-interview/turn`
Body: `{ interview_id, message }`
Auth: student session (must own interview).
Response: SSE stream of LLM tokens → final JSON `{ turn_id, tokens_used }`
Errors: 402 (per-tenant cost cap reached), 410 (interview already completed).

### `POST /api/mock-interview/complete`
Body: `{ interview_id }`
Auth: student session.
Response 200: `{ rubric, score_contribution }`

---

## Internal: API Keys (developer console)

### `POST /api/api-keys`
Body: `{ name: string, scopes: string[] }`
Auth: any authenticated user (developer self-serve).
Response 201: `{ api_key_id, key: "ant_pub_xxxxx" }`  — **plaintext returned exactly once**; client must store.

### `POST /api/api-keys/:id/rotate`
Auth: key owner.
Response 200: `{ key: "ant_pub_xxxxx" }` — new plaintext; previous key revoked.

### `DELETE /api/api-keys/:id`
Auth: key owner.
Response 204.

---

## Internal: Outcome Billing

### `POST /api/outcome-billing/events`
Body: `{ contract_id, student_id, offer_id }`
Auth: service role only (called by placement-confirmation pipeline).
Response 201: `{ event_id, amount, currency }`

### `POST /api/outcome-billing/events/:id/dispute`
Body: `{ reason: string }`
Auth: institution admin session.
Response 200: `{ disputed: true, reversed_at: nullable }`

---

## Public: `/v1/public/*` (API-key authenticated)

### `GET /v1/public/profiles/:slug`
Auth: API key with scope `read:public_profile`.
Headers: `Authorization: Bearer ant_pub_xxxxx`
Response 200: profile JSON (subset of `users` + verified score + skill summary).
Headers on response: `Cache-Control: public, max-age=300`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
Errors: 401 (invalid key), 403 (insufficient scope), 404 (slug not public or unknown), 429 (rate limited).

### `GET /v1/public/credentials/:id`
Auth: API key with scope `read:verifiable_credential`.
Response 200: the W3C VC JSON for the credential.
Errors: same as above.

### `POST /v1/public/webhooks/subscriptions`
Auth: API key with scope `webhook:subscribe`.
Body: `{ event: string, target_url: string }`
Response 201: `{ subscription_id, secret: "whsec_xxxxx" }`  — secret returned exactly once.

### `DELETE /v1/public/webhooks/subscriptions/:id`
Auth: API key with scope `webhook:subscribe` (must own subscription).
Response 204.

---

## Webhook delivery contract

Outbound webhook POST:
```
POST <target_url>
Content-Type: application/json
X-Antarix-Event: <event-name>
X-Antarix-Timestamp: <unix-seconds>
X-Antarix-Signature: t=<unix-seconds>,v1=<hex-hmac-sha256>

{
  "event": "<event-name>",
  "id": "<event-uuid>",
  "data": { ... }
}
```

Signature verification (subscriber side):
```
signed_payload = timestamp + '.' + raw_body
expected = hmac_sha256(secret, signed_payload)
signature_valid = constant_time_eq(expected, v1)
```

Retry policy: 3 attempts with exponential backoff (1s, 8s, 64s). On final failure, subscription is disabled and the subscriber is notified via console + email.

---

## Rate limiting (public API)

- Per-key sliding 1-minute window stored in Postgres counter (`api_rate_counters` table — created in 037).
- Default limit: 100 req/min per key.
- Burst tolerance: 10 req/s.
- Exceeded: response 429 with `Retry-After: 60` and `X-RateLimit-Reset: <unix-seconds>`.
- Per-key custom limits configurable by admin (e.g. enterprise partners can be raised).

---

## Error response shape (all endpoints)

```json
{
  "error": {
    "code": "rate_limited" | "invalid_input" | "not_found" | "forbidden" | "conflict" | "internal_error" | "..." ,
    "message": "<human-readable>",
    "details": { ... }   // optional structured field hints
  }
}
```

---

## Versioning

- Public API is versioned in the URL (`/v1/...`).
- Internal API is unversioned (private to first-party clients).
- Breaking changes to public API trigger a new version path (`/v2/...`); previous version supported for ≥ 12 months.
