# ats-sync-greenhouse

T-ATS-001/003/004/005 — Push matched students to a recruiter's
[Greenhouse Harvest API](https://developers.greenhouse.io/harvest.html)
candidate endpoint, one batch (≤ 50) per invocation.

> **Mirrors** `apps/web/src/lib/ats/greenhouse-client.ts` — keep the
> auth scheme, retry policy, and Retry-After handling in sync. Edge
> Functions cannot import from `apps/web`, so the logic is duplicated
> on purpose.

## Trigger

- Driven by [`ats-sync-evaluator`](../ats-sync-evaluator/README.md)
  (cron, every 5 min via `038_cron_004.sql`).
- Can be invoked directly for debugging:

```bash
curl -X POST http://localhost:54321/functions/v1/ats-sync-greenhouse \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "<uuid>",
    "saved_search_id": "<uuid>",
    "dry_run": false
  }'
```

Set `dry_run: true` to compute the match set without writing to Greenhouse
or `ats_sync_log`. The response includes `matched_user_ids` so you can
preview what *would* be pushed.

## Body

| field             | type      | required | notes                                          |
| ----------------- | --------- | -------- | ---------------------------------------------- |
| `connection_id`   | uuid      | yes      | Must reference an `active` Greenhouse row.     |
| `saved_search_id` | uuid      | yes      | Must reference an `active` row on that conn.   |
| `dry_run`         | boolean   | no       | Default `false`. When `true`, no side effects. |

## Behavior summary

1. Loads `ats_connections` row, asserts `status='active'` and
   `provider='greenhouse'`.
2. Decrypts the stored API key — see "Encryption" below.
3. Loads the `ats_saved_searches` row, asserts `active=true` and that the
   connection matches.
4. Finds up to 50 candidates that:
   - have `candidate_profiles.is_public=true` AND
     `is_open_to_opportunities=true`,
   - match the saved-search `query_json` (skills overlap, min score,
     verified flag, graduation year, institution membership),
   - have **not** already been pushed via this connection
     (`NOT IN (SELECT student_id FROM ats_sync_log WHERE connection_id=? AND status='success')`).
5. For each match, POSTs to `GREENHOUSE_API_BASE/candidates` with HTTP
   Basic Auth (`base64(\`${apiKey}:\`)`).
6. Includes the Skill Proof Score in `custom_fields.antarix_score` and a
   public profile URL in `social_media_addresses` (FR-ATS-004).
7. Retries on `5xx` up to `ATS_SYNC_MAX_ATTEMPTS` (default 3) with
   exponential backoff `0s, 1s, 4s`. On `429` it parses `Retry-After`,
   stops the batch, and leaves the saved search for the next cron tick.
8. On three final failures, the connection is set to `status='paused'`
   and `failure_count` is incremented (FR-ATS-005). A
   `failed_permanent` row is appended to `ats_sync_log`.
9. On success the connection's `last_sync_at` is bumped and
   `failure_count` reset to 0.

## Encryption

The function reads `ats_connections.api_key_encrypted` and tries to
decode it as **base64** first; if the decoded bytes are not printable
ASCII it falls back to treating the column as plaintext. This is a
placeholder — see the **TODO(prod)** in `index.ts`.

The companion encrypt step lives in
`apps/web/src/app/api/ats/connect/route.ts`. Replace both ends together
when wiring real KMS envelope encryption.

The decrypted key is **never logged or echoed**, even on error. Every
log line uses the `connection_id` only.

## Required secrets

| env var                  | default                              | notes                            |
| ------------------------ | ------------------------------------ | -------------------------------- |
| `SUPABASE_URL`           | (auto)                               |                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | (auto)                            |                                  |
| `GREENHOUSE_API_BASE`    | `https://harvest.greenhouse.io/v1`   | overridable for staging mocks    |
| `NEXT_PUBLIC_APP_URL`    | `https://antarix.app`                | used to build the profile URL    |
| `ATS_SYNC_MAX_ATTEMPTS`  | `3`                                  | per-candidate retry budget       |

No Greenhouse-specific app credentials are required — the per-recruiter
API key (encrypted in `ats_connections`) is the only secret.

## Local development

```bash
npx supabase functions serve ats-sync-greenhouse --no-verify-jwt
```

## Production

```bash
npx supabase functions deploy ats-sync-greenhouse
```

## Response

```json
{ "ok": true, "attempted": 5, "succeeded": 5, "failed": 0 }
```

When the batch is interrupted by a 429 the response still returns 200
with the partial counts; the unprocessed candidates are picked up by the
next cron tick.
