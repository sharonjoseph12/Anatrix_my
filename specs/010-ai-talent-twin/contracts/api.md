# 010 — AI Talent Twin — API Contracts

## Endpoints

---

### POST /api/v1/recruiters/talent-twin/ask

Ask a natural-language question about one or more candidates.

**Auth:** Recruiter JWT (company Pro+ plan required)

**Request body:**

```json
{
  "user_ids": ["uuid", "uuid", ...],
  "question": "What distributed-systems work has this candidate done?",
  "max_candidates": 10
}
```

- `user_ids` (required, array[uuid], max 50): The candidates to scope the question to. All must have `talent_twin_opt_in = true`.
- `question` (required, string, max 500 chars): The natural-language question.
- `max_candidates` (optional, int, default 10): If `user_ids` is not provided, the system scopes to the recruiter's last search results and picks the top N by skill-proof score.

**Response 200:**

```json
{
  "answer": "This candidate has significant distributed-systems experience. In commit a3f2c1 [1] they added a Redis cache to the Qdrant query path using a Bloom filter to skip non-existent keys. In commit d4e5f6 [2] they refactored the shard-rebalancing algorithm to use a consistent-hash ring. Both commits are in the antarix/qdrant repository.",
  "citations": [
    {"number": 1, "source_url": "https://github.com/antarix/qdrant/commit/a3f2c1", "title": "Add Redis cache to Qdrant query path", "date": "2026-03-12T14:30:00Z", "chunk_type": "commit"},
    {"number": 2, "source_url": "https://github.com/antarix/qdrant/commit/d4e5f6", "title": "Refactor shard-rebalancing to consistent-hash ring", "date": "2026-03-10T09:15:00Z", "chunk_type": "commit"}
  ],
  "candidate_count": 1,
  "chunks_retrieved": 12,
  "latency_ms": 3420
}
```

**Response 400:** (invalid request)

```json
{
  "error": "invalid_request",
  "message": "question must be between 1 and 500 characters"
}
```

**Response 403:** (recruiter not on Pro+ plan, or quota exhausted)

```json
{
  "error": "forbidden",
  "message": "AI Talent Twin requires a Pro or Enterprise plan. You are on the Starter plan."
}
```

**Response 404:** (all candidates opted out or not found)

```json
{
  "error": "no_eligible_candidates",
  "message": "None of the specified candidates have opted in to the AI Talent Twin."
}
```

**Response 429:** (rate limited — see rate-limit doc)

```json
{
  "error": "rate_limited",
  "retry_after": 30
}
```

**Rate limit:** 30 questions / minute / recruiter (configurable; controlled by the `withRateLimit` wrapper from `_shared/rate-limit.ts`).

**Audit:** Every successful call creates a `talent_twin_qa_log` row.

---

### POST /api/v1/students/talent-twin/opt-in

Toggle the AI Talent Twin opt-in status.

**Auth:** Student JWT

**Request body:**

```json
{
  "opt_in": true
}
```

- `opt_in` (required, boolean)

**Response 200:**

```json
{
  "opt_in": true,
  "chunks_count": 142,
  "message": "AI Talent Twin is now enabled. Your work is visible to recruiters on Pro+ plans."
}
```

**Response 200 (opt-out):**

```json
{
  "opt_in": false,
  "chunks_deleted": 142,
  "message": "AI Talent Twin is now disabled. Your chunks have been deleted. Re-enabling will take 24 hours to rebuild."
}
```

**Note on re-enable:** When a student opts back in, the chunks must be rebuilt by the daily embedder cron. They see the status `"rebuilding"` in `/preview` until the next cron cycle.

---

### GET /api/v1/students/talent-twin/preview

Return a summary of what's in the student's twin — the data the RAG pipeline can access.

**Auth:** Student JWT

**Query parameters:** None.

**Response 200:**

```json
{
  "opt_in": true,
  "opt_in_since": "2026-04-01T00:00:00Z",
  "total_chunks": 142,
  "by_type": {
    "code": 87,
    "commit": 32,
    "ide_session": 18,
    "collaboration": 5
  },
  "top_repos": [
    {"repo": "antarix/qdrant", "chunks": 45, "commits": 12, "lines_added": 1247},
    {"repo": "antarix/frontend", "chunks": 32, "commits": 8, "lines_added": 893},
    {"repo": "personal/leetcode", "chunks": 10, "commits": 2, "lines_added": 315}
  ],
  "claimable_commits": 18,
  "badges_issued": 3,
  "query_count_last_30d": 7,
  "status": "ready"
}
```

- `status`: `"ready"` (chunks available), `"rebuilding"` (opted in but chunks not yet generated), `"disabled"` (opted out).

---

### POST /api/v1/students/talent-twin/badge/issue

Issue an authorship proof badge for selected commits.

**Auth:** Student JWT

**Request body:**

```json
{
  "commits": ["sha1", "sha2", "sha3"],
  "label": "Qdrant contributions 2026"
}
```

- `commits` (required, array[string], max 50): The commit SHAs to include.
- `label` (optional, string, max 100 chars): A human-readable label for the badge. Defaults to "Top commits — <current year>".

**Response 200:**

```json
{
  "badge_id": "uuid",
  "nonce": "uuid",
  "svg_url": "https://antarix.app/badges/authorship/<uuid>.svg",
  "jwt": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": "2026-06-07T00:00:00Z",
  "commits_included": 3,
  "total_lines_authored": 1247
}
```

**Response 400:** (invalid commits, or some commits not claimable)

```json
{
  "error": "commits_not_eligible",
  "message": "2 of 3 commits have authorship_score < 0.8. Claimable: a3f2c1. Not claimable: d4e5f6 (score: 0.45), e6f7a8 (score: 0.32)."
}
```

**Rate limit:** 5 badges / day / student. (Prevents abuse.)

---

### GET /api/v1/badges/verify

Verify an authorship badge (public, no auth).

**Query parameters:**

- `badge_id` (optional, uuid): The badge ID to verify.
- `jwt` (optional, string): The full JWT to verify.

One of `badge_id` or `jwt` must be provided.

**Response 200 (valid):**

```json
{
  "verified": true,
  "subject": {"name": "Riya Sharma", "id": "uuid"},
  "badge_id": "uuid",
  "issued_at": "2026-04-01T00:00:00Z",
  "expires_at": "2026-06-07T00:00:00Z",
  "commits": [
    {"sha": "a3f2c1", "repo": "antarix/qdrant", "lines": 47, "date": "2026-03-12T14:30:00Z"}
  ],
  "revoked": false
}
```

**Response 200 (revoked):**

```json
{
  "verified": false,
  "reason": "revoked",
  "revoked_at": "2026-04-15T10:30:00Z",
  "badge_id": "uuid"
}
```

**Response 404:**

```json
{
  "verified": false,
  "reason": "not_found"
}
```

---

### POST /api/v1/students/talent-twin/badge/revoke

Revoke an authorship badge.

**Auth:** Student JWT

**Request body:**

```json
{
  "badge_id": "uuid",
  "reason": "Included a commit I didn't author"
}
```

**Response 200:**

```json
{
  "revoked": true,
  "badge_id": "uuid",
  "revoked_at": "2026-04-15T10:30:00Z"
}
```

## Error Codes (All Endpoints)

| Code | Meaning |
|---|---|
| `invalid_request` | Missing or malformed request body |
| `unauthorized` | Missing or invalid JWT |
| `forbidden` | JWT is valid but the user lacks the required plan/role |
| `not_found` | Resource not found |
| `rate_limited` | Too many requests; see `Retry-After` header |
| `internal_error` | Unexpected server error |
| `no_eligible_candidates` | All scoped candidates have opted out |
| `commits_not_eligible` | Some or all commits don't meet the authorship threshold |
