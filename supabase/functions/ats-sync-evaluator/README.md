# ats-sync-evaluator

T-ATS-002 — Cron dispatcher for the ATS sync pipeline. Decides **which**
saved searches are due for re-evaluation and fans out to the right
per-provider function.

## Trigger

Scheduled by `038_cron_004.sql` (`ats-sync-evaluator-5m`):

```sql
select cron.schedule(
  'ats-sync-evaluator-5m', '*/5 * * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_url') || '/ats-sync-evaluator',
       headers := jsonb_build_object('Content-Type', 'application/json'),
       body := '{}'::jsonb
     ); $$
);
```

Can also be invoked directly for debugging:

```bash
curl -X POST http://localhost:54321/functions/v1/ats-sync-evaluator \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"sweep":true}'
```

The body is informational only.

## Behavior summary

1. Loads every `ats_connections` row with `status='active'`.
2. Loads every `ats_saved_searches` row with `active=true` whose
   `last_evaluated_at` is **NULL** or **older than `ATS_SYNC_CRON_MINUTES`
   minutes** (default 5).
3. For each `(connection, saved_search)` pair, POSTs to
   `ats-sync-{provider}` with a service-role bearer:

   ```json
   { "connection_id": "<uuid>", "saved_search_id": "<uuid>" }
   ```

4. Updates `ats_saved_searches.last_evaluated_at = now()` **unconditionally
   after dispatch** — even if the dispatch returned an error — so a broken
   saved search cannot busy-loop the evaluator. Failures are surfaced via
   the per-provider function's `ats_sync_log` rows and connection-pause
   path.

Dispatches are awaited sequentially: within a 5-minute cron tick we have
ample time for hundreds of HTTP calls, and serial dispatch avoids
bursting parallel pushes against the same recruiter's upstream API.

## Required secrets

| env var                  | default | notes                                          |
| ------------------------ | ------- | ---------------------------------------------- |
| `SUPABASE_URL`           | (auto)  |                                                |
| `SUPABASE_SERVICE_ROLE_KEY` | (auto) | required to invoke the sibling Edge Functions |
| `ATS_SYNC_CRON_MINUTES`  | `5`     | staleness threshold for re-evaluation          |

## Local development

```bash
npx supabase functions serve ats-sync-evaluator --no-verify-jwt
```

## Production

```bash
npx supabase functions deploy ats-sync-evaluator
```

## Response

```json
{ "ok": true, "dispatched": 7, "dispatch_errors": 0 }
```

`dispatched` counts how many `(connection, saved_search)` pairs were
sent to a sync function; the individual per-candidate counts are in
each sync function's response (not aggregated here).
