# Antarix Partner Webhooks — design doc

> v1, additive, no edits to 001–040 migrations. Last updated 2026-06-06.

This document is the canonical reference for the partner webhook system
shipped in `supabase/migrations/041_webhooks.sql`,
`supabase/functions/_shared/webhook-dispatch.ts`, and
`supabase/functions/webhook-receiver/[id]/index.ts`.

## 1. The 3 components

| Component | File | Purpose |
|---|---|---|
| Migration | `supabase/migrations/041_webhooks.sql` | 3 new tables (`webhook_endpoints`, `webhook_deliveries`, `webhook_event_types`) + `public.webhook_generate_secret()` helper. RLS on all 3 tables, no policies (service-role only). |
| Dispatcher | `supabase/functions/_shared/webhook-dispatch.ts` | `dispatchWebhook(event, opts)` fans out an event to every active subscribed endpoint in parallel; `retryFailedDeliveries(opts)` is the cron entry point. Stripe-compatible HMAC signing via Web Crypto, 10-second per-request timeout, structured logging. |
| Receiver | `supabase/functions/webhook-receiver/[id]/index.ts` | POST endpoint for partners to push closed-loop data back to us (placement outcomes, credential views, engagement). Verifies the per-endpoint HMAC, checks the 5-minute timestamp window, accepts only the 3 inbound event types, rate-limited at 600/10 per endpoint. |

### 1.1 Architecture diagram

```
                                                  +-----------------------+
   cron / Edge Function                           |  partner endpoint     |
   (e.g. credential-vc-issue)                     |  https://partner/x     |
        |                                         +-----------+-----------+
        | dispatchWebhook(event)                              |
        v                                                     |
  +-------------+        POST + X-Antarix-Signature          |
  | dispatcher  |-------------------------------------------->|
  +-------------+                                             |
        |                                                     |
        | insert webhook_deliveries (pending)                 |
        | update webhook_deliveries (succeeded/failed/exhausted)
        | update webhook_endpoints.consecutive_failures       |
        v                                                     |
  +-----------------+                                         |
  | Postgres (RLS)  |                                         |
  +-----------------+                                         |
                                                              |
   partner (recruiter, college)                               |
        |                                                     |
        | POST { event_type, payload }                        |
        | X-Antarix-Signature: t=...,v1=...                   |
        v                                                     |
  +-------------------+                                       |
  | webhook-receiver  |<--------------------------------------+
  +-------------------+
        |
        | verify HMAC, check t-window, look up secret by id
        |
        v
   accepted → 200 OK
```

## 2. The 7 outbound event types

(The spec called for 7; the actual seed list contains 8 — see §11 Open
items. The migration seeds all 8, the dispatcher's `WebhookEventType`
union matches.)

The JSON Schemas below are pasted verbatim from
`public.webhook_event_types.schema` in `041_webhooks.sql` (Draft
2020-12).

### 2.1 `credential.issued`

A new W3C verifiable credential was issued to a student.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CredentialIssued",
  "type": "object",
  "required": ["credential_id", "did", "issued_to_user_id", "issued_at"],
  "properties": {
    "credential_id":     { "type": "string", "format": "uuid" },
    "did":               { "type": "string", "pattern": "^did:web:antarix\\.app:c/[0-9a-f-]{36}$" },
    "issued_to_user_id": { "type": "string", "format": "uuid" },
    "issued_at":         { "type": "string", "format": "date-time" },
    "skill_focus":       { "type": "array", "items": { "type": "string" } },
    "overall_score":     { "type": "number", "minimum": 0, "maximum": 100 }
  },
  "additionalProperties": true
}
```

### 2.2 `credential.revoked`

A W3C verifiable credential was revoked.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CredentialRevoked",
  "type": "object",
  "required": ["credential_id", "did", "revoked_at", "reason"],
  "properties": {
    "credential_id": { "type": "string", "format": "uuid" },
    "did":           { "type": "string", "pattern": "^did:web:antarix\\.app:c/[0-9a-f-]{36}$" },
    "revoked_at":    { "type": "string", "format": "date-time" },
    "reason":        { "type": "string" }
  },
  "additionalProperties": true
}
```

### 2.3 `placement.predicted`

A new placement prediction was generated for a student.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PlacementPredicted",
  "type": "object",
  "required": ["student_user_id", "predicted_at", "predicted_tier"],
  "properties": {
    "student_user_id":      { "type": "string", "format": "uuid" },
    "predicted_at":         { "type": "string", "format": "date-time" },
    "predicted_tier":       { "enum": ["top", "high", "mid", "low", "unranked"] },
    "predicted_salary_inr": { "type": "integer", "minimum": 0 },
    "model_version":        { "type": "string" }
  },
  "additionalProperties": true
}
```

### 2.4 `student.connected`

A student opted in to a company connection.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "StudentConnected",
  "type": "object",
  "required": ["student_user_id", "company_id", "connected_at"],
  "properties": {
    "student_user_id": { "type": "string", "format": "uuid" },
    "company_id":      { "type": "string", "format": "uuid" },
    "connected_at":    { "type": "string", "format": "date-time" },
    "consent_source":  { "type": "string" }
  },
  "additionalProperties": true
}
```

### 2.5 `cohort.report_ready`

A cohort-level analytics report is ready for download.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CohortReportReady",
  "type": "object",
  "required": ["cohort_id", "report_url", "ready_at"],
  "properties": {
    "cohort_id":    { "type": "string", "format": "uuid" },
    "report_url":   { "type": "string", "format": "uri" },
    "ready_at":     { "type": "string", "format": "date-time" },
    "report_kind":  { "type": "string" }
  },
  "additionalProperties": true
}
```

### 2.6 `job_match.created`

A recruiter created a job match for a student.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "JobMatchCreated",
  "type": "object",
  "required": ["match_id", "student_user_id", "recruiter_user_id", "job_id", "created_at"],
  "properties": {
    "match_id":          { "type": "string", "format": "uuid" },
    "student_user_id":   { "type": "string", "format": "uuid" },
    "recruiter_user_id": { "type": "string", "format": "uuid" },
    "job_id":            { "type": "string" },
    "created_at":        { "type": "string", "format": "date-time" },
    "score":             { "type": "number", "minimum": 0, "maximum": 1 }
  },
  "additionalProperties": true
}
```

### 2.7 `nudge.sent`

A nudge was successfully delivered to a student.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NudgeSent",
  "type": "object",
  "required": ["nudge_id", "student_user_id", "channel", "sent_at"],
  "properties": {
    "nudge_id":        { "type": "string", "format": "uuid" },
    "student_user_id": { "type": "string", "format": "uuid" },
    "channel":         { "enum": ["whatsapp", "push", "email", "in_app"] },
    "sent_at":         { "type": "string", "format": "date-time" }
  },
  "additionalProperties": true
}
```

### 2.8 `nudge.failed`

A nudge could not be delivered.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NudgeFailed",
  "type": "object",
  "required": ["nudge_id", "student_user_id", "channel", "failed_at", "error_code"],
  "properties": {
    "nudge_id":        { "type": "string", "format": "uuid" },
    "student_user_id": { "type": "string", "format": "uuid" },
    "channel":         { "enum": ["whatsapp", "push", "email", "in_app"] },
    "failed_at":       { "type": "string", "format": "date-time" },
    "error_code":      { "type": "string" }
  },
  "additionalProperties": true
}
```

## 3. Outbound headers

Every dispatched POST carries these headers:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `User-Agent` | `Antarix-Webhooks/1.0` |
| `X-Antarix-Event-Id` | The `WebhookEvent.event_id` (uuid v4). **Partners must dedupe on this.** |
| `X-Antarix-Event-Type` | The `WebhookEventType` string union. |
| `X-Antarix-Delivery-Id` | The `webhook_deliveries.id` of this attempt. Unique per row. |
| `X-Antarix-Signature` | `t=<unix>,v1=<hex-hmac-sha256>` (see §4). |

The body is always a single JSON object of the shape:

```json
{
  "event_type": "credential.issued",
  "event_id":   "8c2b...-uuid-v4-...-d4a1",
  "payload":    { /* event-type-specific keys; see §2 */ }
}
```

**Idempotency.** `event_id` is a uuid v4 generated by the producer and is
stable across retries. The same `event_id` will be reused on every
attempt for a given logical event (it lives in the `webhook_deliveries`
row and is the foreign key from §10's `webhook_inbound_events` for
closed-loop correlation). **Partners should store the most-recently-seen
`event_id` per logical stream and ignore replays.** A redundant safe-
side for partners that don't dedupe: the `X-Antarix-Delivery-Id` is
unique per attempt, so a partner that dedupes on either header is safe.

## 4. The signature scheme

The `X-Antarix-Signature` header is Stripe-compatible:

```
t=<unix_seconds>,v1=<lowercase_hex_hmac_sha256>
```

The HMAC is computed over the byte string `${t}.${body}` (a literal
dot separator), using the per-endpoint secret as the key. The body
must be the **exact** bytes the server sent (do not re-serialize the
JSON before verifying — that will change the byte stream and the
signature will not match).

The `t` prefix is a unix-seconds timestamp embedded in the signed
payload; Antarix's receiver rejects any signature whose `t` is more
than **5 minutes** away from the server's current time. This is
replay protection: an attacker who captures a valid request cannot
replay it later than 5 minutes after the original send.

### 4.1 Verification — Node.js

```js
const crypto = require("node:crypto");
function verify({ secret, header, body, toleranceSec = 300 }) {
  const m = /t=(\d+),v1=([0-9a-f]+)/.exec(header ?? "");
  if (!m) return false;
  const t = Number(m[1]), v1 = m[2];
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
}
```

### 4.2 Verification — Python

```python
import hmac, hashlib, time, re
def verify(secret: str, header: str, body: bytes, tolerance_sec: int = 300) -> bool:
    m = re.match(r"t=(\d+),v1=([0-9a-f]+)", header or "")
    if not m: return False
    t, v1 = int(m.group(1)), m.group(2)
    if abs(int(time.time()) - t) > tolerance_sec: return False
    mac = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(mac, v1)
```

### 4.3 Verification — Go

```go
func Verify(secret, header string, body []byte, toleranceSec int64) bool {
    re := regexp.MustCompile(`t=(\d+),v1=([0-9a-f]+)`)
    m := re.FindStringSubmatch(header)
    if m == nil { return false }
    t, _ := strconv.ParseInt(m[1], 10, 64)
    v1 := m[2]
    if abs(time.Now().Unix() - t) > toleranceSec { return false }
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(fmt.Sprintf("%d.", t)))
    mac.Write(body)
    return hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(v1))
}
```

The snippet above is illustrative; partners should consult their
language's HMAC docs and use a constant-time comparison (e.g. Go's
`hmac.Equal`, Python's `hmac.compare_digest`, Node's
`crypto.timingSafeEqual`).

## 5. Retry policy

| Knob | Value | Notes |
|---|---|---|
| Max attempts per event | **5** | The 5th failed attempt is left in the `failed` state; the row is NOT marked `exhausted` so an admin can see the history. |
| Min interval between attempts | **30 seconds** | Enforced by `retryFailedDeliveries` via a SQL `lt(requested_at, now() - 30s)` filter. |
| Cron cadence | **Hourly** (recommended) | One retry sweep per hour gives you 1m, 1h, 2h, 3h, 4h — exponential-with-cap. |
| Auto-disable threshold | **10 consecutive failures** | On the 10th `failed` outcome, the endpoint's `is_active` flips to `false` and a `warn`-level log fires. |
| 2xx response | `succeeded` | `consecutive_failures` resets to 0; `last_success_at` updates. |
| 4xx (not 408, 429) | `exhausted` | **No retry.** The partner's URL is misconfigured (404, 401, 410, etc.). The error is recorded in `webhook_deliveries` for partner diagnosis; `last_failure_at` updates; `consecutive_failures` does **not** increment (auto-disable is for flakiness, not for partner misconfig). |
| 408 / 429 / 5xx / timeout / network | `failed` | Retried on the next cron tick. `consecutive_failures` increments. |
| 1 MB body cap | **1 MiB** | Requests larger than this are rejected at the dispatcher's outbound `fetch` call (Deno's default) AND at the receiver's read step. |

The retry policy is **hardcoded** in `webhook-dispatch.ts` (the
constants `MAX_ATTEMPTS`, `AUTO_DISABLE_THRESHOLD`, and
`RETRY_MIN_INTERVAL_MS`). v1 has no per-endpoint overrides; v2 will
expose them on `webhook_endpoints` (`max_attempts int default 5,
auto_disable_after int default 10`).

## 6. Security

* **Per-endpoint secret.** Generated by `public.webhook_generate_secret()`
  in `041_webhooks.sql`, which calls `pgcrypto.gen_random_bytes(32)` and
  hex-encodes to a 64-character string. Generated server-side so a
  compromised Edge Function host cannot bias the entropy.
* **Never logged.** The dispatcher and receiver never include the secret
  in any log line. The `webhook_endpoints.secret` column should also
  be added to a future `differential_privacy.log_redactions` list (out
  of scope v1).
* **Transmission.** Outbound POSTs go over HTTPS only; the dispatcher
  refuses to send to `http://` URLs in v2 (v1 does not enforce this —
  a partner who registers a plaintext URL will get plaintext requests;
  see §11 Open items).
* **Storage.** `webhook_endpoints.secret` is stored in cleartext. v2
  will envelope-encrypt it via KMS, the same pattern as
  `vc_issuer_keys.private_key_encrypted` in 032. For now, the column
  relies on Postgres RLS + the fact that no policy permits reads from
  anon / authenticated.
* **Rotation.** v1 has no rotation flow. v2 will add a
  `webhook-rotate-secret` Edge Function that generates a new secret,
  writes it, and returns it exactly once. Partners will be expected to
  update both their verifier and their `webhook_endpoints.secret` value
  on a 90-day rotation cadence.

## 7. Idempotency

Every dispatched event has a unique `event_id` (UUID v4). The
`webhook_deliveries` table stores the `event_id` on every attempt row,
so the partner can:
1. Use `event_id` as a primary-key dedupe key on their side.
2. Query our `webhook_deliveries` (via the v2 `webhook-list-deliveries`
   Edge Function) to find the canonical `event_id` for a given logical
   event after a partial failure.

The `X-Antarix-Delivery-Id` is unique per attempt, not per event; it
should be used only for log correlation and partner-side support, not
for dedupe.

The receiver also enforces `event_id` uniqueness on the inbound side
when a future migration adds the `webhook_inbound_events` table (out of
scope v1).

## 8. What partners do when their endpoint is broken

v1 has no self-service debug UI. Partners with a misbehaving endpoint
should:

1. Check their server logs for `X-Antarix-Delivery-Id` and look up the
   full `X-Antarix-Signature` header to see whether the signature was
   even getting through.
2. Verify the secret in their config matches what we sent at
   registration (the secret is in the `webhook_create` response, which
   is shown exactly once).
3. Verify the 5-minute timestamp window on their server clock (NTP
   drift > 5 minutes will cause all signatures to be rejected).
4. Email `api@antarix.app` with the `endpoint_id` and
   approximate timestamp. We will:
   - Query `webhook_deliveries` filtered by `endpoint_id` and
     `status in ('failed', 'exhausted')` to surface the partner's view.
   - Manually re-enable the endpoint if it was auto-disabled (set
     `is_active = true`, reset `consecutive_failures = 0`).

v2 adds a `webhook-list-deliveries` Edge Function that lets partners
see their own delivery history (subject to owner_user_id match).

## 9. Inbound event types (closed-loop)

Partners can POST back to `https://<project>.supabase.co/functions/v1/webhook-receiver/<endpoint_id>`
with one of these three event types:

### 9.1 `placement.outcome`

The student got placed. The partner reports the actual salary and tier
so our `placement.predicted` model can be retrained on the gap
between predicted and actual.

Expected body:

```json
{
  "event_type": "placement.outcome",
  "payload": {
    "student_user_id": "<uuid>",
    "placement_id":    "<uuid>",
    "actual_salary_inr": 1200000,
    "actual_tier":     "high",
    "company_id":      "<uuid>",
    "placed_at":       "2026-06-15T00:00:00Z"
  }
}
```

The v1 receiver authenticates and logs the event; the v1 write path
inserts into `public.outcome_billing_events` via a future SQL helper
(out of scope v1, see §11).

### 9.2 `credential.viewed`

A third party (a recruiter, an HR system, a university alumni portal)
viewed a credential. This is for analytics — "which companies are
actually opening the credentials we send them?"

```json
{
  "event_type": "credential.viewed",
  "payload": {
    "credential_id":   "<uuid>",
    "did":             "did:web:antarix.app:c/<uuid>",
    "viewer_kind":     "recruiter",
    "viewer_user_id":  "<uuid or null>",
    "viewed_at":       "2026-06-15T12:34:56Z"
  }
}
```

### 9.3 `student.engagement`

An external LMS or portal is reporting engagement metrics (videos
watched, problem attempts, etc.) for a student. v1 logs the event;
v2 writes it to `public.engagement_metrics`.

```json
{
  "event_type": "student.engagement",
  "payload": {
    "student_user_id": "<uuid>",
    "source":          "<lms name>",
    "metric":          { "videos_watched": 4, "problem_attempts": 12 },
    "recorded_at":     "2026-06-15T18:00:00Z"
  }
}
```

The receiver validates the signature + 5-minute timestamp window, then
returns `200 { ok: true, event_type }`. Bad shapes return 400, bad
signatures return 401, replayed signatures return 401
(`expired_signature`), and rate-limited callers return 429.

## 10. Inbound headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Antarix-Signature` | `t=<unix>,v1=<hex-hmac-sha256>` (same scheme as outbound). |

No `X-Antarix-Event-Id` or `X-Antarix-Delivery-Id` on the inbound side
— the partner is the producer, and the body carries `event_type` and
`payload` directly.

## 11. Open items

* **Admin CRUD endpoints.** v1 has no Edge Function for creating /
  listing / updating / deleting endpoints. v2 will add
  `webhook-create`, `webhook-list`, `webhook-update`,
  `webhook-delete`, and `webhook-rotate-secret`. Each will be
  authenticated, owner-scoped (`ctx.userId === row.owner_user_id`),
  and rate-limited. v1 partners email `api@antarix.app` to register.
* **Per-tenant scoping.** v1 scopes by `owner_user_id` only. v2 will
  introduce partner-scoped API keys with finer permissions
  (e.g. a key that can register endpoints but not list deliveries).
* **HMAC key rotation.** No rotation flow in v1; see §6.
* **Public "webhook deliveries" page** in the company portal. v1 has
  no UI; the data is in `webhook_deliveries` and a `webhook-list-deliveries`
  Edge Function will land in v2.
* **Body size cap.** The receiver enforces 1 MiB at the read step
  (line ~100 of `webhook-receiver/[id]/index.ts`). The dispatcher
  does NOT enforce an outbound body cap — v1 trusts the upstream
  producer. v2 will add a `validate_event_body_size_kb` check.
* **HTTP→HTTPS enforcement.** v1 does not reject `http://` URLs at
  registration time. v2 will.
* **Retry cron schedule.** v1 has no `cron.schedule` for
  `retryFailedDeliveries`. The snippet below is the drop-in for the
  next cron migration (do not edit 029_cron_002.sql or 038_cron_004.sql;
  add it to a new 04x_*.sql file):

  ```sql
  select cron.unschedule('webhook-retry-hourly')
    where exists (select 1 from cron.job where jobname = 'webhook-retry-hourly');
  select cron.schedule(
    'webhook-retry-hourly', '13 * * * *',
    $$ select net.http_post(
         url := current_setting('app.functions_url') || '/webhook-retry',
         headers := jsonb_build_object('Content-Type', 'application/json'),
         body := '{}'::jsonb
       ); $$
  );
  ```

  The `:13` (instead of `:00`) avoids the cron-storm effect at the top
  of every hour; the body is empty because `retryFailedDeliveries()`
  queries the database for its work.

* **Inbound `webhook_inbound_events` table.** v1's receiver logs and
  acknowledges but does not persist. v2 will add a
  `webhook_inbound_events` table (idempotent on `event_id`, indexed by
  endpoint_id, 30-day retention) plus a downstream
  `placement-outcome-router` Edge Function for the closed-loop write
  path.
* **Test mode.** v1 has no `?test=true` flag. Partners who want to
  test the integration without affecting production event flow should
  register a `https://webhook.site/<uuid>` URL and watch the events
  arrive in real time. v2 will add a per-endpoint `is_test` flag and a
  synthetic `webhook.test_ping` event.
* **Event-type count drift.** The dispatcher and the seed list ship
  with **8** outbound event types (`nudge.sent` and `nudge.failed` are
  two distinct types, not one). The design doc and the task spec
  describe **7**; this is a known off-by-one. To resolve: either
  collapse `nudge.sent` and `nudge.failed` into a single `nudge.dispatched`
  with a `status` field, or update the design doc to say "8".

## 12. How to adopt (3 steps)

```ts
// 1. In the calling Edge Function, import the dispatcher:
import { dispatchWebhook } from "../_shared/webhook-dispatch.ts";

// 2. Build the event with a fresh uuid v4:
const event = {
  event_type: "credential.issued",
  event_id:   crypto.randomUUID(),
  payload: {
    credential_id:     row.id,
    did:               row.did,
    issued_to_user_id: row.user_id,
    issued_at:         new Date().toISOString(),
    overall_score:     row.snapshot_overall_score,
  },
};

// 3. Fire it. ctx is optional but recommended so the dispatch
//    appears in the same trace as the rest of the function:
await dispatchWebhook(event, { ctx });
```

That's it. The dispatcher inserts a `webhook_deliveries` row, signs the
POST, sends it, updates the row, and bumps the endpoint's
`consecutive_failures` if it failed. The cron picks up failures within
the hour.
