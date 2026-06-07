# Generate Insights

Edge Function that runs every Monday at 04:00 UTC to compute a fresh batch of
insights for every user with at least 7 days of activity. Insights replace the
prior week's batch in the same `generated_for_week` slot (idempotent).

## Insight types emitted

- `peak_window` — 4-hour block with the highest weighted focus score
- `workflow_pattern` — most-common category order on the user's most productive days
- `skill_detection` — dominant language based on last 7 days of GitHub commits
- `productivity_trend` — total hours + average focus this week

## Required env

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto)

## Local development

```bash
npx supabase functions serve generate-insights --no-verify-jwt
```

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/generate-insights' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000"}'
```

## Production

```bash
npx supabase functions deploy generate-insights
```

The pg_cron schedule lives in `migrations/012_cron_jobs.sql` (entry
`generate-insights-weekly`).
