# Edge Function Rate Limiting (v1)

Status: v1 — drop-in token-bucket wrapper for the 28 Supabase Edge Functions.
No existing `index.ts` is modified; the other agent adopts this per-function.
Owner: Agent B-3. Module: `supabase/functions/_shared/rate-limit.ts`.
Migration: `supabase/migrations/033_rate_limit.sql`.
Tests: `supabase/functions/_shared/rate-limit.test.ts`.

---

## 1. The model

A classic **token bucket**:

- `capacity` — the **burst** size. The bucket is created full and never
  holds more than this many tokens.
- `refill_per_second` — the **sustained** rate. Tokens drip into the bucket
  at this rate, up to `capacity`.
- `cost` — tokens consumed per call (default `1`). Set higher for expensive
  endpoints (e.g. AI calls).
- A call is **allowed** iff the bucket has at least `cost` tokens after
  refill. Otherwise it is **denied** and `retry_after_seconds = (cost − tokens) / refill_per_second`.

The bucket is stored as one row in `public.rate_limit_buckets` keyed by
`bucket_key`. The refill, check and deduct happen atomically in the SQL
function `public.rate_limit_consume`; see §6.

---

## 2. Recommended per-function configs

These live in `defaultConfigs` in `rate-limit.ts`. The wrapper uses
`_default` for any function name not in this table — it never throws.

| Function                  | Capacity (burst) | Refill / sec | Sustained         |
|---------------------------|-----------------:|-------------:|-------------------|
| `nudge-dispatch`          |               30 |        0.5   | 30 / min          |
| `ai-coach`                |               10 |        0.167 | 1 every 6 s       |
| `credential-vc-resolve`   |               60 |        1     | 1 / s (public)    |
| `credential-vc-issue`     |                5 |        0.1   | 1 every 10 s (crypto) |
| `whatsapp-send`           |               20 |        0.333 | 1 every 3 s       |
| `recruiter-search`        |               30 |        0.5   | 30 / min          |
| `_default`                |               60 |        1     | 1 / s             |

Override per-call by passing `{capacity, refillPerSecond, cost}` to
`checkRateLimit` or `withRateLimit`.

---

## 3. Three-step adoption guide

For each of the other 27 Edge Functions:

1. **Add the import** at the top of `index.ts`:

   ```ts
   import { withRateLimit } from "../_shared/rate-limit.ts";
   ```

2. **Wrap the observability-wrapped handler**. If the function already uses
   the observability wrapper (recommended), wire them like this — outer
   wrapper rate-limits *before* inner does any work:

   ```ts
   serve(
     withRateLimit("ai-coach", "ai-coach",
       withObservability("ai-coach", handler),
     ),
   );
   ```

   The second arg is either a key into `defaultConfigs` or a full
   `RateLimitConfig` object (`{capacity, refillPerSecond, cost?}`).

3. **Or, for fine control**, call `checkRateLimit` inside your handler and
   short-circuit yourself. This is how to apply different limits to
   different code paths within one function (e.g. cheap GET vs. expensive
   POST):

   ```ts
   serve(withObservability("ai-coach", async (req, ctx) => {
     const r = await checkRateLimit(ctx, "ai-coach", {
       capacity: 5,
       refillPerSecond: 0.1,
     });
     if (!r.allowed) {
       return new Response(
         JSON.stringify({ error: "rate_limited", retry_after: r.retryAfter }),
         {
           status: 429,
           headers: {
             "Content-Type": "application/json",
             "Retry-After":  String(Math.max(1, Math.ceil(r.retryAfter))),
           },
         },
       );
     }
     return doWork(req, ctx);
   }));
   ```

The wrapper **fails open** on any RPC error (DB down, RPC missing, network
hiccup): it logs a `warn` line via `ctx.log` and lets the request through.
This is the right default for a non-critical guard — we never want the
rate-limiter to take the site down.

---

## 4. `bucket_key` format

The wrapper composes `bucket_key` as:

```
<identity>:fn:<function-name>
```

where `<identity>` is one of:

- `user:<uuid>` if `ctx.userId` is present (best-effort JWT `sub`
  extracted by `withObservability` and re-extracted by `withRateLimit`),
  **or**
- `ip:<request-id>` as the unauth fallback.

### Known limitation (v1)

`ObsContext` does **not** carry the real client IP. The unauth path uses
`ctx.requestId` — which is **fresh per request** — meaning unauthenticated
callers each get their own bucket and are not effectively rate-limited by
this layer. Three mitigations exist today:

- Supabase's gateway-level per-IP limit still applies (see §8).
- The `credential-vc-resolve` (public) function should set
  `capacity: 60, refillPerSecond: 1` — generous, because per-IP enforcement
  is the gateway's job.
- For functions that must reject anon traffic outright, return `401` before
  this wrapper would even run.

The v2 plan is to plumb `x-forwarded-for` / `x-real-ip` through
`ObsContext` and switch the fallback to `ip:<real-ip>`. Tracked under
"per-IP hard limit" in §7.

---

## 5. 30-day GC

`rate_limit_buckets` grows unbounded with one row per unique
`(identity, function)`. The retention is **30 days since last_refill_at**.
The inline `DELETE` at the bottom of `033_rate_limit.sql` runs once on
migration. To run it daily, **add the following to a future cron migration**
— do **NOT** edit `029_cron_002.sql` (finalised in the 002 layer):

```sql
select cron.schedule(
  'rate-limit-gc-daily',
  '0 3 * * *',
  $$ delete from public.rate_limit_buckets
       where last_refill_at < now() - interval '30 days' $$
);
```

`rate_limit_buckets_last_refill_idx` (created in migration 033) makes this
scan cheap.

---

## 6. Atomicity of `rate_limit_consume`

The function is `language plpgsql volatile security definer set search_path = public`.
The interesting bit is the upsert-then-update pattern:

```sql
insert into public.rate_limit_buckets (...) values (...)
on conflict (bucket_key) do update
  set capacity = excluded.capacity,
      refill_per_second = excluded.refill_per_second
returning rate_limit_buckets.tokens, rate_limit_buckets.last_refill_at
     into v_tokens, v_last;

-- ... compute refill ...

update public.rate_limit_buckets
   set tokens = v_after, last_refill_at = v_now
 where bucket_key = p_bucket_key;
```

**Why this is atomic per `bucket_key`:**

- `INSERT … ON CONFLICT DO UPDATE` takes a **row-level exclusive lock** on
  the conflicting row.
- The lock is held for the duration of the **calling transaction**. A
  client `select rate_limit_consume(…)` is one implicit transaction, so the
  lock persists through the subsequent `UPDATE`.
- Two concurrent calls on the same `bucket_key` therefore serialize: the
  second `INSERT … ON CONFLICT` blocks until the first transaction commits.
- Different `bucket_key` values do not contend (Postgres row-level locks
  are per row).

**Verification status:** This is a documented Postgres semantic
(`INSERT … ON CONFLICT DO UPDATE` locks the conflicting row for the
remainder of the transaction). We have not run a concurrency stress test
against a live database yet; that is a v1.1 follow-up. The wrapper's
**fail-open** behaviour means a transient lock-wait timeout will allow
rather than reject the request, which is the safe failure mode.

---

## 7. What's NOT in v1

These are deliberate omissions, all queued for v2:

- **Per-IP hard limit.** v1 keys by `user_id` (or fresh `request_id`).
  Real per-IP enforcement needs `x-real-ip` plumbed through `ObsContext`.
- **Geo-fencing.** No CIDR or country blocking. Add at the gateway or
  Cloudflare layer.
- **Abuse scoring.** No reputation, no captcha trigger, no graduated
  response. v1 is a flat token bucket.
- **Distributed coordination.** Buckets live in Postgres, which is already
  the strongly-consistent backing store. No Redis / Memcached layer.
- **Cost telemetry.** v1 emits a `warn` log on RPC error but does not
  emit a counter on every 429. The next observability batch (B-4?) can
  surface 429 rate as a panel.

---

## 8. Why not just use Supabase's gateway rate-limit?

Supabase's gateway already enforces a coarse per-IP limit. We built this
layer because:

1. **Per-user, not per-IP.** A library / classroom can have 100 students
   behind one NAT. The gateway can't tell them apart; we can (their JWT
   `sub` is distinct).
2. **Per-function granularity.** AI calls cost $0.01–$0.10 each; resolve
   calls are free. A single global limit either lets AI calls spam or
   throttles cheap public resolves. We need both burst and rate per
   endpoint.
3. **Per-call cost.** A future "batch AI" endpoint may charge `cost: 5`.
   The gateway can't model this.
4. **In-app observability.** The 429 originates from our Edge Function, so
   the response carries our `traceparent` / `x-request-id` and is shown in
   our logs alongside the original request. Gateway 429s would be opaque.

The two layers are complementary: the gateway catches volumetric attacks
(thousands of req/s from one IP); this wrapper catches per-user abuse
within a normal traffic envelope.

---

## 9. Running the tests

```bash
deno test supabase/functions/_shared/rate-limit.test.ts
```

The test file stubs `supabase.rpc` with an in-process token bucket that
mirrors `rate_limit_consume`'s algorithm, so no live database is required.
Test coverage:

- First call within capacity → allowed
- Burst exhausted → denied with `retryAfter > 0`
- Refill works (50 ms at 100 / s → ~5 tokens)
- Different bucket keys are independent
- Unknown function name → `_default` config
- Unauthenticated → `ip:<requestId>` identity
- RPC error → fails open + logs `warn`
- `withRateLimit` returns `429` with `Retry-After` on denial
- `withRateLimit` accepts a `defaultConfigs` key as the config arg

The SQL function itself (atomicity, refill math under contention) is best
verified by an integration test against a live Postgres, which is out of
scope for this batch.
