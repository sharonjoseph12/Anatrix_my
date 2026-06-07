# ats-sync-lever

T-ATS-001/003/004/005 — Push matched students to a recruiter's
[Lever v1 API](https://hire.lever.co/developer/documentation) candidate
endpoint, one batch (≤ 50) per invocation.

> **Mirrors** `apps/web/src/lib/ats/lever-client.ts` — keep the auth
> scheme, retry policy, and Retry-After handling in sync. Edge Functions
> cannot import from `apps/web`, so the logic is duplicated on purpose.

## Trigger

- Driven by [`ats-sync-evaluator`](../ats-sync-evaluator/README.md)
  (cron, every 5 min via `038_cron_004.sql`).
- Can be invoked directly for debugging:

```bash
curl -X POST http://localhost:54321/functions/v1/ats-sync-lever \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "<uuid>",
    "saved_search_id": "<uuid>",
    "dry_run": false
  }'
```

Set `dry_run: true` to compute the match set without writing to Lever or
to `ats_sync_log`.

## Body

| field             | type      | required | notes                                          |
| ----------------- | --------- | -------- | ---------------------------------------------- |
| `connection_id`   | uuid      | yes      | Must reference an `active` Lever row.          |
| `saved_search_id` | uuid      | yes      | Must reference an `active` row on that conn.   |
| `dry_run`         | boolean   | no       | Default `false`. When `true`, no side effects. |

## Behavior summary

Same overall pipeline as
[`ats-sync-greenhouse`](../ats-sync-greenhouse/README.md). The
provider-specific differences:

- **No pool concept.** Lever applications are against postings, so this
  function never makes a second pool-assign request. The
  `ats_connections.pool_id` column is ignored for Lever rows.
- **Scoring delivery.** Lever stores the Skill Proof Score as **tags**
  on the candidate (`source:antarix`, `antarix-score:87`,
  `antarix-score-80+`) rather than custom fields, so recruiters can
  filter natively inside Lever (FR-ATS-004).
- **Rate limits.** Lever's documented limit is 10 req/s. The 50-per-call
  batch combined with the 5-min cron cadence stays well under that.
- **Auth.** Same HTTP Basic scheme as Greenhouse:
  `base64(\`${apiKey}:\`)`.

## Encryption

Reads `ats_connections.api_key_encrypted`, tries base64 decode first,
falls back to plaintext. See the **TODO(prod)** in `index.ts`. The
companion encrypt step lives in
`apps/web/src/app/api/ats/connect/route.ts`.

The decrypted key is **never logged or echoed**.

## Required secrets

| env var                  | default                       | notes                            |
| ------------------------ | ----------------------------- | -------------------------------- |
| `SUPABASE_URL`           | (auto)                        |                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | (auto)                     |                                  |
| `LEVER_API_BASE`         | `https://api.lever.co/v1`     | overridable for staging mocks    |
| `NEXT_PUBLIC_APP_URL`    | `https://antarix.app`         | used to build the profile URL    |
| `ATS_SYNC_MAX_ATTEMPTS`  | `3`                           | per-candidate retry budget       |

No Lever-specific app credentials are required.

## Local development

```bash
npx supabase functions serve ats-sync-lever --no-verify-jwt
```

## Production

```bash
npx supabase functions deploy ats-sync-lever
```

## Response

```json
{ "ok": true, "attempted": 5, "succeeded": 5, "failed": 0 }
```
