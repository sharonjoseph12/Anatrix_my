# dsa-sync

DSA sync edge function — see `specs/003-engage-and-showcase/quickstart.md`.

## Local test

```bash
# Refresh a single user
curl -X POST http://localhost:54321/functions/v1/dsa-sync \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>","platform":"leetcode"}'

# Sweep: refresh every active row that's older than 6h
curl -X POST http://localhost:54321/functions/v1/dsa-sync \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"sweep":true}'

# Same for HackerRank
curl -X POST http://localhost:54321/functions/v1/dsa-sync \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>","platform":"hackerrank"}'
```

## Nudge dispatcher smoke test

```bash
# Process up to 50 pending notifications through the channel resolver.
# Re-uses the dsa-sync repo; this is the sibling nudge-dispatch-extended
# function. Run on-demand to verify channel wiring end-to-end.
curl -X POST "http://localhost:54321/functions/v1/nudge-dispatch-extended?limit=50" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Cron

Run on a 6h schedule via `pg_cron` (entry in `012_cron_jobs.sql`):

```sql
select cron.schedule('dsa-sync-6h', '0 */6 * * *', $$
  select net.http_post(
    url := current_setting('app.functions_url') || '/dsa-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"sweep":true}'::jsonb
  );
$$);
```
