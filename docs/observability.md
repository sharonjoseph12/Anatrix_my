# Edge Function Observability (v1)

Status: v1 — drop-in wrapper for the 28 Supabase Edge Functions. No existing
`index.ts` is modified; the other agent adopts this per-function.
Owner: Agent A-3. Module: `supabase/functions/_shared/observability.ts`.
Reference implementation: `supabase/functions/health-check/index.ts`.
Tests: `supabase/functions/_shared/observability.test.ts`.

---

## 1. The wrapper at a glance

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { withObservability } from "../_shared/observability.ts";

serve(withObservability("my-fn", async (req, ctx) => {
  ctx.log.info("doing the thing", { user_id: ctx.userId });
  const child = ctx.span.startChild("db.query");
  // ...do work...
  child.end();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}));
```

That is the whole public surface. `ctx.log` has `info` / `warn` / `error`;
`ctx.span` has `setAttribute` / `recordException` / `startChild` / `end`. Both
are bound to the active request and carry `request_id` and `trace_id`
automatically.

---

## 2. Three-step adoption guide

For each of the other 27 Edge Functions:

1. **Add the import** at the top of `index.ts`:

   ```ts
   import { withObservability } from "../_shared/observability.ts";
   ```

2. **Wrap the existing handler**. If the function currently looks like

   ```ts
   serve(async (req) => { ... });
   ```

   change it to

   ```ts
   serve(withObservability("calendar-sync", async (req, ctx) => { ... }));
   ```

   The function name passed as the first arg is the `function_name` field
   on every log line and span — use the directory name (e.g.
   `"calendar-sync"`, not `"Calendar Sync"`).

3. **Replace `console.log` with `ctx.log.info`** inside the handler.
   `ctx.log.warn` and `ctx.log.error` exist too. Optional: emit
   `ctx.span.recordException(err)` in your `catch` blocks so spans flip
   to `status: "ERROR"` and carry an `exception` event.

No other changes are required. The wrapper handles: parsing the incoming
`traceparent`, generating a `trace_id` if absent, extracting a best-effort
`user_id` from the bearer token, writing the access log, and echoing
`traceparent` + `x-request-id` on the response.

The reference implementation to copy-paste from is
`supabase/functions/health-check/index.ts`.

---

## 3. Output format

### 3.1 Log line (one per request, plus any `ctx.log.*` calls)

```json
{
  "level": "info",
  "msg": "request",
  "function_name": "calendar-sync",
  "request_id": "8f1b6c0a-...-...",
  "timestamp": "2026-06-04T10:21:33.412Z",
  "trace_id": "0af7651916cd43dd8448eb211c80319c",
  "span_id": "b7ad6b7169203331",
  "user_id": "user-123",
  "method": "POST",
  "path": "/functions/v1/calendar-sync",
  "status": 200,
  "duration_ms": 142.7,
  "client_ip": "203.0.113.42"
}
```

A `ctx.log.info("user signed in", { cohort: "2026-cs" })` call emits the same
shape with `msg: "user signed in"` and the extra fields merged in:

```json
{
  "level": "info",
  "msg": "user signed in",
  "function_name": "auth-fn",
  "request_id": "...",
  "timestamp": "...",
  "trace_id": "...",
  "span_id": "...",
  "cohort": "2026-cs"
}
```

The `level` field on the access log is derived from the HTTP status: `error`
on `5xx`, `warn` on `4xx`, `info` otherwise.

### 3.2 Span record (one per ended span, OpenTelemetry-shaped)

```json
{
  "type": "span",
  "name": "calendar-sync.handler",
  "function_name": "calendar-sync",
  "trace_id": "0af7651916cd43dd8448eb211c80319c",
  "span_id": "b7ad6b7169203331",
  "parent_span_id": "00a23bf71a0e0d01",
  "start_time_unix_nano": 1717494093412000000,
  "end_time_unix_nano":   1717494093554700000,
  "duration_ms": 142.7,
  "status": "OK",
  "attributes": {
    "http.method": "POST",
    "http.route": "/functions/v1/calendar-sync",
    "http.status_code": 200
  },
  "events": []
}
```

On error, `status` becomes `"ERROR"` and an `exception` event is appended:

```json
"events": [
  {
    "name": "exception",
    "time_unix_nano": 1717494093551000000,
    "attributes": {
      "exception.message": "Google Calendar API 401",
      "exception.stacktrace": "Error: Google Calendar API 401\n    at fetch..."
    }
  }
]
```

This shape is intentionally close to the OpenTelemetry Log & Span data model
(see §5 for the migration path).

### 3.3 Response headers

The wrapper sets two headers on every response:

| Header        | Value                                            | Why |
|---------------|--------------------------------------------------|-----|
| `traceparent` | `00-{trace_id}-{span_id}-01`                     | W3C trace context — downstream services can continue the trace. |
| `x-request-id`| The `request_id` (or the value Supabase sent)    | Correlate browser/network logs with our server logs. |

---

## 4. Wiring stdout to a log shipper

The wrapper writes to `console.log`, which on Supabase Edge Functions goes
to **stdout** and is captured by the Supabase log stream. To get the lines
into a real backend, point one of these at the function's stdout:

| Backend | Path |
|---|---|
| **Vector** (recommended) | Sidecar or DaemonSet with `source: stdin` or `source: docker_logs`, sinks to Datadog / Loki / ClickHouse / S3. Cheapest, fastest, OpenTelemetry-native. |
| **Fluent Bit** | Same shape — `INPUT: tail` on the log file Supabase writes, or a sidecar. Heavier than Vector but ubiquitous. |
| **Datadog** | Datadog Agent's `logs` integration auto-tails container stdout; or `datadog-api` forwarder. |
| **Grafana Cloud (Loki)** | Grafana Agent or Promtail tailing the logs. |
| **Sentry** | Sentry's Deno SDK can be added per-function; or pipe the JSON to a Sentry log drain. |
| **Helicone** | For LLM calls specifically, swap `ctx.log.info` for the Helicone proxy and keep this wrapper for everything else. |

The recommended minimal setup is a **Vector sidecar**: parse the JSON line
with `parse_json` (no VRL needed for our flat shape), tag by
`function_name`, and ship. One YAML file, ~30 lines.

---

## 5. The OpenTelemetry migration path (v2)

v1 implements a *minimal* tracer in-house because the Antarix 002 base ships
without `@opentelemetry/api`. When the project is ready to adopt real OTel,
the public API does not change.

What the v1 in-house impl gives you today (and what `@opentelemetry/api`
gives you later) maps cleanly:

| v1 (`observability.ts`)         | OTel equivalent                              |
|---------------------------------|----------------------------------------------|
| `ctx.span = makeSpan(...)`      | `trace.getTracer("antarix").startSpan(...)`  |
| `ctx.span.setAttribute(k, v)`   | identical                                    |
| `ctx.span.recordException(err)` | identical                                    |
| `ctx.span.startChild(name)`     | `tracer.startSpan(name, { parent })`         |
| `ctx.span.end()`                | `span.end()`                                 |
| `emit(spanRecord)` to stdout    | `BatchSpanProcessor` → OTLP exporter          |
| `emit(logRecord)` to stdout     | `logs.emit` via `BatchLogRecordProcessor`     |

To migrate: replace the body of `makeSpan` and `makeLogger` with the
`@opentelemetry/api` calls, add an OTLP exporter at module load
(`OTLPTraceExporter` + `BatchSpanProcessor` + `NodeSDK` — for Deno, use
`@opentelemetry/exporter-trace-otlp-http`), and the call sites in every
adopted function stay byte-identical. `ctx.log` already returns
`info/warn/error`; switch its internals to the OTel `Logger` API and the
semantics are preserved.

The W3C `traceparent` parsing/building code stays as-is — OTel's
`propagation.inject` / `propagation.extract` use the same format.

---

## 6. What is NOT in v1 (the v2 roadmap)

These are explicitly out of scope for v1, by design, to keep the wrapper
small (≤ 150 lines) and zero-dep:

- **External exporter** — spans/logs go to stdout only. A log shipper picks
  them up. See §4.
- **Sampling** — every request is recorded. A `head` or `probability`
  sampler can be added inside `withObservability` once traffic warrants it.
- **Baggage** (W3C `baggage` header) — not parsed or emitted. Easy add in
  v2: two more helpers in the same file.
- **Metrics** (counters, histograms) — v1 logs `duration_ms` and `status`
  on the access line, which is enough for the most common SLO queries
  (`rate`, `p95`, `error_ratio`). Native OTel `Counter` / `Histogram` are a
  v2 addition; the public surface will grow a `ctx.meter` object.
- **PII redaction** — `ctx.log.info` writes whatever you pass it. Functions
  that log full request bodies must redact before calling. A v2 helper
  `redact(obj, keys)` is planned.
- **Source maps for stack traces** — `exception.stacktrace` is the raw
  string. Deno's `sourceMap` option will clean this up.

---

## 7. Hard constraints honoured

- **No edits to any existing `index.ts`.** This module and the health-check
  function are the only new files in `supabase/functions/`. All other
  adoption is owned by Agent B.
- **No new external dependencies.** Pure Deno stdlib. `crypto.randomUUID`,
  `crypto.getRandomValues`, `performance`, `atob`, `btoa` are all
  runtime built-ins; the test file uses `https://deno.land/std@0.224.0/assert`
  which is already in the import map.
- **Works with `serve` from `std@0.224.0`.** Same version the other 27
  functions use. The wrapper returns a `(req: Request) => Promise<Response>`
  which is exactly what `serve` expects.
- **≤ 150 lines for the main module.** Actual: see the final message.
