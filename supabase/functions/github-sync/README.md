# GitHub Sync

Edge Function that fetches recent commit activity for a connected GitHub account
and writes it into the `github_activity` table. Idempotent (unique on
`user_id, commit_hash`) and token-aware: on 401/403 the account is marked
`expired` so the UI can prompt a re-connect.

## Flow

1. `github-callback` invokes this function once on first OAuth connect.
2. `pg_cron` (see `migrations/012_cron_jobs.sql`) re-invokes it every 2 hours
   for all users with an active GitHub account.
3. Web dashboard can also POST `{ "user_id": "..." }` to force a manual sync.

## Required secrets

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto)

No GitHub-specific secrets are required — the function reuses the per-user
OAuth token stored at connect time.

## Local development

```bash
npx supabase functions serve github-sync --no-verify-jwt
```

Trigger manually:

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/github-sync' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","full_sync":true}'
```

## Production

```bash
npx supabase functions deploy github-sync
```

## Notes

- Uses the **events API** (cheap, no per-repo loops) plus a one-time repos API
  call per sync to map language → commit.
- Paginates up to 5 pages of 100 events (~500 events ≈ several months of history).
- For the first sync (`last_synced_at IS NULL` or `full_sync=true`) we look back
  90 days; subsequent syncs are incremental from the last successful timestamp.
