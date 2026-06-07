# Session Upload Edge Function

Receives session batches from the Chrome extension and persists them with idempotent sync.

## Endpoint

`POST /functions/v1/session-upload`

## Headers

- `Authorization: Bearer <supabase_jwt>` — user's access token
- `Content-Type: application/json`

## Request body

```json
{
  "sessions": [
    {
      "client_id": "uuid-from-extension",
      "category": "coding",
      "project_name": "Sign Language Recognition",
      "started_at": "2026-06-04T18:30:00.000Z",
      "ended_at": "2026-06-04T20:15:00.000Z",
      "duration_minutes": 105,
      "focus_level": "high",
      "focus_score": 0.87,
      "tab_switches": 12,
      "distraction_seconds": 240
    }
  ]
}
```

## Response (200)

```json
{
  "accepted": 3,
  "duplicates": 0,
  "rejected": 0,
  "errors": [],
  "session_ids": ["uuid1", "uuid2", "uuid3"]
}
```

## Validation

- `client_id` is required (used for idempotent upsert)
- `category` must be one of: `dsa`, `coding`, `project`, `learning`, `research`
- `focus_level` must be one of: `high`, `medium`, `low`
- `focus_score` must be in `[0, 1]`
- Max 200 sessions per batch

## Idempotency

Upserts on `(user_id, client_id)` constraint. Repeated syncs of the same session
return it as a `duplicate` rather than creating new rows.

## Local development

```bash
npx supabase functions serve session-upload --no-verify-jwt
```

## Production

```bash
npx supabase functions deploy session-upload
```
