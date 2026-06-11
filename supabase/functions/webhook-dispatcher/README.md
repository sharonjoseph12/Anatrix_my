# webhook-dispatcher

Outbound webhook delivery Edge Function for the 11/10 developer-facing public API.

## Modes

The function accepts two POST bodies (mutually exclusive):

### Sweep mode (cron)

```json
{ "sweep": true }
```

Scans `public.webhook_deliveries` for rows that are due for an attempt:

- `status = 'pending'`
- OR (`status = 'retry'` AND `created_at + INTERVAL '1 second' * POWER(8, attempt - 1) <= now()`)

The `POWER(8, attempt - 1)` gives the contract's backoff curve: 1s, 8s, 64s.

Up to **100** rows are processed per invocation. Schedule every 60s for sub-minute
worst-case delivery latency at low scale; raise the cadence once volume grows.

### Immediate mode (low-latency)

```json
{ "delivery_id": 4242 }
```

Re-fires a single specific delivery row. Used by an at-least-once fast path that
sits between the trigger helper (`enqueueWebhookEvent` in
`apps/web/src/lib/api/webhook-triggers.ts`) and the next sweep tick.

## Per-delivery flow

1. Look up the parent `webhook_subscriptions` row (service-role, bypasses RLS).
2. Look up the parent `api_keys` row to read `subject_id` (for the email-alert stub).
3. Build the event-specific payload by re-fetching the underlying source row:
   - `score.updated`     → `candidate_profiles` for `event_id = user_id`
   - `credential.issued` → `verifiable_credentials` for `event_id = id`
   - `placement.confirmed` → `student_applications` for `event_id = id`
4. Sign the JSON body: `HMAC-SHA256(secret, "${ts}.${rawBody}")` with the secret
   described in the v1 trade-off below.
5. POST to `target_url` with the contract headers:
   - `X-Antarix-Event: <event-name>`
   - `X-Antarix-Timestamp: <unix-seconds>`
   - `X-Antarix-Signature: t=<unix-seconds>,v1=<hex>`
   - `X-Antarix-Delivery-Id: <bigserial>`
   - `X-Antarix-Event-Id: <event-uuid>`
6. **Timeout: 10s** (AbortController).
7. Update `webhook_deliveries`:
   - **2xx**: `status='success'`, `delivered_at=now()`.
   - **408/429/5xx with attempt < 3**: `status='retry'`, `attempt = attempt + 1`.
   - **Otherwise (4xx, 5xx with attempt = 3, network error)**: `status='failed_permanent'`.
8. After **3 consecutive `failed_permanent`** for the same subscription, set
   `webhook_subscriptions.active = false` and emit a warn log carrying the
   `subject_id` (the email-alert send is a TODO stub in v1).

The function returns `{ ok, processed, succeeded, failed }`.

## v1 TRADE-OFF — signing key

`public.webhook_subscriptions` only stores `secret_hash` (bcrypt). The plaintext
secret is shown to the developer exactly once at subscription-create time
(`POST /api/v1/public/webhooks/subscriptions`) and never persisted server-side.

For v1 the dispatcher signs with `secret_hash` as the HMAC key. This works for
the sign side (we have the hash) but **breaks the verify side**: a partner who
has the plaintext secret cannot re-derive the bcrypt hash (bcrypt is
non-deterministic; each call yields a different hash even for the same input),
so they cannot reproduce the HMAC. The signature header is therefore advisory
in v1.

### Migration plan

A future migration (referenced as a TODO in the dispatcher code) will add one
of:

- a `secret_plain text` column (RLS-deny read for everyone but the service role), OR
- a `secret_encrypted bytea` column holding an envelope-encrypted blob whose
  key is held in KMS.

Either fix lets the dispatcher sign with the actual secret. Until then,
partners should treat the signed payload as advisory and confirm state via
`GET /api/v1/public/credentials/:id` or the candidate profile lookup.

## Auth

The function is **service-role only** — `--no-verify-jwt` on deploy. The
underlying tables (`webhook_deliveries`, `webhook_subscriptions`, `api_keys`,
`candidate_profiles`, `verifiable_credentials`, `student_applications`) have
RLS policies that block anon / authenticated writes; only the service role
bypasses them.

## Local dev

```bash
npx supabase functions serve webhook-dispatcher --no-verify-jwt
curl -X POST http://localhost:54321/functions/v1/webhook-dispatcher \
  -H 'content-type: application/json' \
  -d '{"sweep": true}'
```

## Deploy

```bash
npx supabase functions deploy webhook-dispatcher --no-verify-jwt
```

Add a `cron.schedule` entry to invoke `{ sweep: true }` every 60s in a future
cron migration (this wave does not edit `038_cron_004.sql`).

## TODO / follow-up

- Add `secret_plain` (or KMS-encrypted) column to `webhook_subscriptions`
  and migrate the dispatcher to sign with the plaintext secret.
- Replace the email-alert stub with a call to the `nudge-send` (or new
  `email-alert`) Edge Function.
- The `dispatcher_sweep_due` RPC is referenced as a fast-path; if the
  migration has not yet added it, the dispatcher falls back to a plain
  `status in ('pending','retry')` SELECT (acceptable but re-does work
  for rows that aren't yet due).
