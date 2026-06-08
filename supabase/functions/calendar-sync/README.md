# Calendar Sync

Edge Function that pulls recent and upcoming Google Calendar events for a
connected account and stores them in `calendar_events`. Refreshes the OAuth
access token on expiry, marks the account `expired` on persistent failure, and
infers a `category` for each event from keywords in the title/description so
the Brief / Peak Self pages can correlate focus blocks with sessions.

## Flow

1. `pg_cron` invokes this function every 6 hours for every user with an active
   `calendar_accounts` row (see `migrations/012_cron_jobs.sql`).
2. Web dashboard can also POST `{ "user_id": "..." }` to force a manual sync.

## Required secrets

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Local development

```bash
npx supabase functions serve calendar-sync --no-verify-jwt
```

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/calendar-sync' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","full_sync":true}'
```

## Production

```bash
npx supabase functions deploy calendar-sync
npx supabase secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx
```

## Notes

- Window: 30 days back to 14 days forward from `last_synced_at` (or now if
  first sync). Captures both retrospective focus blocks and upcoming meetings.
- 250 events per request; pagination not needed for normal student loads.
- `category` mapping is heuristic — `study`/`learn` → `learning`,
  `interview`/`standup`/`meeting` → `meeting`, `build`/`project`/`deploy` →
  `project`, `dsa`/`leetcode`/`contest` → `dsa`, `research`/`paper` →
  `research`.
- Transparent events (e.g. "Free") are stored with `is_focused = false`.
