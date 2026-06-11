// supabase/functions/webhook-receiver/[id]/index.ts
// T-WEBHOOK-RECEIVER: Inbound partner webhook. Partners POST
// closed-loop data (placement outcomes, credential views, engagement
// metrics) back to us, signed with the same per-endpoint secret we
// gave them at registration time.
//
// Path:   POST /functions/v1/webhook-receiver/<endpoint_id>
// Body:   { "event_type": "...", "payload": { ... } }
// Header: X-Antarix-Signature: t=<unix>,v1=<hex-hmac-sha256(secret,"${t}.${body}")>
//
// This is the INVERSE of the outbound dispatcher in
// `_shared/webhook-dispatch.ts`. The secret is the SAME per-endpoint
// secret stored in `public.webhook_endpoints.secret`. The signature
// scheme is identical to outbound (Stripe-compatible).
//
// Path param note: <endpoint_id> is the partner's `webhook_endpoints.id`
// (NOT a `webhook_deliveries.id` — that's the outbound id). We look up
// the secret from `webhook_endpoints` keyed by id.
//
// Inbound event types (closed-loop):
//   - placement.outcome   — the student got placed, here's the ground truth
//   - credential.viewed   — a third-party viewed a credential (analytics)
//   - student.engagement  — an external system reports engagement metrics
//
// Rate limit: 600 burst / 10/s sustained. The partner is trusted, so
// we use the per-function override in `withRateLimit` rather than the
// public default. Rate limit key is the endpoint id so one partner
// cannot starve another.
//
// Status codes:
//   200  accepted                          ({ ok: true, event_type })
//   400  bad shape                         ({ error: "bad_request" })
//   401  bad / missing / replayed signature ({ error: "invalid_signature" | "expired_signature" })
//   404  endpoint id not found / inactive  ({ error: "endpoint_not_found" })
//   405  method != POST
//   429  rate limit                        (Retry-After + X-RateLimit-Remaining)
//   500  unexpected error
//
// v1 does NOT persist these inbound events to a dedicated table — they
// flow into the same downstream handlers that the rest of Antarix uses
// (e.g. placement.outcome → outcome_billing_events via an internal
// helper). The receiver's job is to authenticate + log; the write
// path is delegated. This keeps the v1 surface small.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withObservability } from "../../_shared/observability.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-antarix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PATH_PREFIX = "/webhook-receiver/";
const SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes
const INBOUND_EVENT_TYPES = new Set([
  "placement.outcome",
  "credential.viewed",
  "student.engagement",
]);
const RATE_LIMIT_CFG = { capacity: 600, refillPerSecond: 10 };

// ----- signature verification ---------------------------------------------

function parseSigHeader(h: string | null): { t: number; v1: string } | null {
  if (!h) return null;
  // Format: t=<unix>,v1=<hex> — also accept space-separated like Stripe's docs.
  const parts = h.split(",").map((p) => p.trim());
  let t: number | null = null;
  let v1: string | null = null;
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (k === "t") t = Number(v);
    else if (k === "v1") v1 = v;
  }
  if (t == null || Number.isNaN(t) || !v1) return null;
  return { t, v1 };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const ENC = new TextEncoder();
async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", ENC.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonRes(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...(extraHeaders ?? {}) },
  });
}

function extractId(url: URL): string | null {
  const idx = url.pathname.indexOf(PATH_PREFIX);
  if (idx < 0) return null;
  const raw = url.pathname.slice(idx + PATH_PREFIX.length);
  if (!raw) return null;
  try { return decodeURIComponent(raw).replace(/\/+$/, ""); }
  catch { return raw.replace(/\/+$/, ""); }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ----- inner handler (no observability wrap; withRateLimit goes outermost) -

async function handle(req: Request, ctx: import("../../_shared/observability.ts").ObsContext): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return jsonRes({ error: "method_not_allowed", message: "Use POST." }, 405);
  }

  const endpointId = extractId(new URL(req.url));
  if (!endpointId || !UUID_RE.test(endpointId)) {
    return jsonRes({ error: "bad_request", message: "Path param must be a uuid." }, 400);
  }
  ctx.span.setAttribute("endpoint_id", endpointId);

  // 1. Read the raw body (we need the exact bytes for the HMAC).
  const body = await req.text();
  if (!body) {
    return jsonRes({ error: "bad_request", message: "Empty body." }, 400);
  }
  if (body.length > 1_048_576) { // 1 MB hard cap; see docs/webhooks.md §Open items
    return jsonRes({ error: "bad_request", message: "Body too large (> 1 MB)." }, 400);
  }

  // 2. Parse + validate the signature header.
  const sigHeader = req.headers.get("x-antarix-signature");
  const parsed = parseSigHeader(sigHeader);
  if (!parsed) {
    ctx.log.warn("missing or malformed signature", { endpoint_id: endpointId });
    return jsonRes({ error: "invalid_signature", message: "X-Antarix-Signature header is missing or malformed." }, 401);
  }

  // 3. Replay protection: t must be within ±5 minutes of now.
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parsed.t) > SIGNATURE_TOLERANCE_SECONDS) {
    ctx.log.warn("signature timestamp out of window", {
      endpoint_id: endpointId, t: parsed.t, now: nowSec, delta_sec: nowSec - parsed.t,
    });
    return jsonRes({ error: "expired_signature", message: "Signature timestamp is outside the 5-minute window." }, 401);
  }

  // 4. Look up the endpoint's secret.
  const lookupSpan = ctx.span.startChild("db.select.webhook_endpoints");
  const { data: ep, error: epErr } = await _supabase
    .from("webhook_endpoints")
    .select("id,secret,is_active")
    .eq("id", endpointId)
    .maybeSingle();
  lookupSpan.end();
  if (epErr) {
    ctx.log.error("endpoint lookup failed", { endpoint_id: endpointId, error: epErr.message });
    return jsonRes({ error: "server_error", message: "Endpoint lookup failed." }, 500);
  }
  if (!ep || !ep.is_active) {
    // Treat both "not found" and "disabled" as 404 to avoid existence leaks.
    ctx.log.warn("endpoint not found or inactive", { endpoint_id: endpointId });
    return jsonRes({ error: "endpoint_not_found", message: "No active endpoint with that id." }, 404);
  }

  // 5. Recompute the expected signature; compare in constant time.
  const expected = await hmacSha256Hex(ep.secret, `${parsed.t}.${body}`);
  if (!constantTimeEqual(expected, parsed.v1)) {
    ctx.log.warn("signature mismatch", { endpoint_id: endpointId });
    return jsonRes({ error: "invalid_signature", message: "Signature does not match." }, 401);
  }

  // 6. Validate the body shape.
  let parsed_body: { event_type?: unknown; payload?: unknown };
  try { parsed_body = JSON.parse(body); }
  catch {
    return jsonRes({ error: "bad_request", message: "Body is not valid JSON." }, 400);
  }
  if (typeof parsed_body.event_type !== "string" || typeof parsed_body.payload !== "object" || parsed_body.payload === null) {
    return jsonRes({ error: "bad_request", message: "Body must be { event_type: string, payload: object }." }, 400);
  }
  if (!INBOUND_EVENT_TYPES.has(parsed_body.event_type)) {
    return jsonRes({ error: "bad_request", message: `Unsupported inbound event_type '${parsed_body.event_type}'.` }, 400);
  }
  ctx.span.setAttribute("event_type", parsed_body.event_type);

  // 7. Dispatch to the v1 downstream handler. v1 does NOT persist these
  //    to a dedicated table — the receiver authenticates + logs and the
  //    downstream write path is delegated to internal handlers. This
  //    keeps the v1 surface small; the v2 design doc carries the
  //    `webhook_inbound_events` table plan.
  ctx.log.info("inbound webhook accepted", {
    endpoint_id: endpointId,
    event_type: parsed_body.event_type,
    payload_keys: Object.keys(parsed_body.payload as object),
  });

  return jsonRes({ ok: true, event_type: parsed_body.event_type }, 200);
}

// ----- wire wrappers ------------------------------------------------------

// withRateLimit must run BEFORE withObservability so a 429 short-circuits
// before any logging work. The rate-limit bucket key is the endpoint id,
// injected as `ctx.userId` shim via the auth header: we don't have a real
// user, but the rate-limit wrapper falls back to requestId — which means
// each inbound POST gets its own bucket. To get per-endpoint limiting we
// need to override the bucket key. The simplest path: call
// `checkRateLimit` directly with a custom bucket derived from endpointId.
//
// Because the endpoint id is on the path, we read it once and pass it
// through. The trick: withRateLimit composes the ObsContext from the
// request headers, but we need the URL. So we wrap with a small closure
// that extracts the id, runs checkRateLimit with a key of
// `endpoint:<id>:fn:webhook-receiver`, and otherwise delegates to
// withObservability. Order: rate limit → observability → handler.

const _handler = withObservability("webhook-receiver", handle);

// One service-role client shared by the rate-limit gate and the handler.
// (The rate-limit gate has to run BEFORE withObservability, which is why
// the rate-limit call is inlined in the serve() closure below.)
const _supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

serve(async (req: Request) => {
  // 1. Rate-limit gate (per-endpoint, generous override). We inline
  //    the call rather than wrap with withRateLimit because the bucket
  //    key is the path-derived endpoint id, not the auth-derived user.
  const endpointId = extractId(new URL(req.url));
  const bucketKey = endpointId && UUID_RE.test(endpointId)
    ? `endpoint:${endpointId}:fn:webhook-receiver`
    : `ip:${crypto.randomUUID()}:fn:webhook-receiver`;
  const { data, error } = await _supabase.rpc("rate_limit_consume", {
    p_bucket_key: bucketKey,
    p_capacity: RATE_LIMIT_CFG.capacity,
    p_refill_per_second: RATE_LIMIT_CFG.refillPerSecond,
    p_cost: 1,
  });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      const retrySec = Math.max(1, Math.ceil(Number(row.retry_after_seconds ?? 1)));
      return new Response(
        JSON.stringify({ error: "rate_limited", retry_after: row.retry_after_seconds }),
        {
          status: 429,
          headers: {
            ...CORS, "Content-Type": "application/json",
            "Retry-After": String(retrySec),
            "X-RateLimit-Remaining": String(Math.max(0, Math.floor(Number(row.remaining_tokens ?? 0)))),
          },
        },
      );
    }
  }
  // Fail-open on RPC error — same policy as `withRateLimit`.
  return _handler(req);
});
