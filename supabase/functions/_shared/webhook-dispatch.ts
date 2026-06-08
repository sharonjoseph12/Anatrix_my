// supabase/functions/_shared/webhook-dispatch.ts
// v1 outbound webhook dispatcher for Antarix partner integrations.
//
//   dispatchWebhook(event, opts)  — fan out to every active subscribed endpoint.
//   retryFailedDeliveries(opts)   — cron entry point; re-fires failed rows.
//
// Signature scheme (Stripe-compatible):
//   X-Antarix-Signature: t=<unix>,v1=<hex-hmac-sha256(secret, "${t}.${body}")>
// Retry policy: max 5 attempts, hourly cron cadence, 30s per-row minimum
// to avoid hot-looping a dead endpoint; 10 consecutive_failures auto-disables.
//
// Pure Deno stdlib + @supabase/supabase-js@2.45.0. HMAC uses Web Crypto
// (works in Deno Deploy and Node 20+). No new external deps.
// See docs/webhooks.md.

import type { ObsContext } from "./observability.ts";

export const WEBHOOK_EVENT_TYPES = [
  "credential.issued", "credential.revoked", "placement.predicted",
  "student.connected", "cohort.report_ready", "job_match.created",
  "nudge.sent", "nudge.failed",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookEvent {
  event_type: WebhookEventType;
  event_id: string; // uuid v4 — partners dedupe on this
  payload: Record<string, unknown>;
}
export interface DispatchOptions {
  ctx?: ObsContext;
  timeoutMs?: number;
  functionName?: string;
}
export interface DispatchOutcome {
  endpoint_id: string; url: string; ok: boolean;
  status: "succeeded" | "failed" | "exhausted";
  response_status: number | null; error?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;
const AUTO_DISABLE_THRESHOLD = 10;
const RETRY_MIN_INTERVAL_MS = 30_000;
const RESPONSE_BODY_EXCERPT_MAX = 2048;
const USER_AGENT = "Antarix-Webhooks/1.0";
const FUNCTION_NAME = "webhook-dispatch";

// ----- supabase client (lazy, injectable, mirrors rate-limit.ts) ----------

interface EndpointRow { id: string; url: string; secret: string; consecutive_failures: number }
interface DeliveryId { id: string }
interface FailedRow {
  id: string; endpoint_id: string; event_type: string;
  event_id: string; payload: Record<string, unknown>;
  attempt_number: number; requested_at: string;
}
// Permissive Supabase surface; structural typing handles the rest.
type SupabaseLike = {
  from: (table: string) => unknown;
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
};

let _cachedClient: Promise<SupabaseLike> | null = null;
let _factory: () => Promise<SupabaseLike> = defaultFactory;

async function defaultFactory(): Promise<SupabaseLike> {
  if (_cachedClient) return _cachedClient;
  _cachedClient = (async () => {
    const mod = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    // deno-lint-ignore no-explicit-any
    const denoEnv = (globalThis as any).Deno?.env;
    return mod.createClient(
      denoEnv?.get("SUPABASE_URL") ?? "",
      denoEnv?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    ) as unknown as SupabaseLike;
  })();
  return _cachedClient;
}

export function __setSupabaseFactoryForTesting(
  f: (() => SupabaseLike | Promise<SupabaseLike>) | null,
): void {
  _cachedClient = null;
  _factory = f ? (async () => await f()) : defaultFactory;
}

// ----- internal logger ----------------------------------------------------

interface InternalLogger {
  info(m: string, f?: Record<string, unknown>): void;
  warn(m: string, f?: Record<string, unknown>): void;
  error(m: string, f?: Record<string, unknown>): void;
}
function makeLogger(ctx: ObsContext | undefined, fn: string): InternalLogger {
  if (ctx) {
    const w = (l: "info"|"warn"|"error", m: string, f?: Record<string, unknown>) =>
      ctx.log[l](m, { fn, ...(f ?? {}) });
    return { info: (m, f) => w("info", m, f), warn: (m, f) => w("warn", m, f), error: (m, f) => w("error", m, f) };
  }
  const e = (l: string, m: string, f?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: l, msg: m, fn, ...(f ?? {}) }));
  return { info: (m, f) => e("info", m, f), warn: (m, f) => e("warn", m, f), error: (m, f) => e("error", m, f) };
}

// ----- HMAC signing (exported for tests + docs) ---------------------------

const ENC = new TextEncoder();
export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", ENC.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function buildSignatureHeader(secret: string, unixTs: number, body: string): Promise<string> {
  return hmacSha256Hex(secret, `${unixTs}.${body}`).then((hex) => `t=${unixTs},v1=${hex}`);
}

// ----- tiny Supabase-result helpers ---------------------------------------

function rows<T>(r: { data: T | T[] | null; error: { message?: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message);
  if (r.data == null) return [];
  return Array.isArray(r.data) ? r.data : [r.data];
}
function one<T>(r: { data: T | null; error: { message?: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  if (r.data == null) throw new Error("no_row");
  return r.data;
}

// ----- dispatch -----------------------------------------------------------

/**
 * Fire `event` to every active endpoint subscribed to `event.event_type`.
 * Never throws; per-endpoint failures are recorded in `webhook_deliveries`
 * and the endpoint's `consecutive_failures` counter.
 */
export async function dispatchWebhook(event: WebhookEvent, opts: DispatchOptions = {}): Promise<void> {
  const log = makeLogger(opts.ctx, opts.functionName ?? FUNCTION_NAME);
  const client = await _factory();

  // deno-lint-ignore no-explicit-any
  const sel: any = await (client.from("webhook_endpoints") as any)
    .select("id,url,secret,consecutive_failures")
    .eq("is_active", true)
    .contains("subscribed_events", [event.event_type]);
  let endpoints: EndpointRow[];
  try { endpoints = rows(sel) as EndpointRow[]; }
  catch (e) { log.error("endpoint lookup failed", { error: String(e) }); return; }

  if (endpoints.length === 0) {
    log.info("no subscribers", { event_type: event.event_type, event_id: event.event_id });
    return;
  }
  log.info("dispatching", {
    event_type: event.event_type, event_id: event.event_id, subscriber_count: endpoints.length,
  });

  const body = JSON.stringify({ event_type: event.event_type, event_id: event.event_id, payload: event.payload });
  await Promise.allSettled(endpoints.map((ep) =>
    dispatchOne(client, log, ep, event, body, 1, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  ));
}

async function dispatchOne(
  client: SupabaseLike, log: InternalLogger, endpoint: EndpointRow,
  event: WebhookEvent, body: string, attemptNumber: number, timeoutMs: number,
): Promise<DispatchOutcome> {
  // Insert the delivery row first so we have a stable id for the
  // X-Antarix-Delivery-Id header.
  // deno-lint-ignore no-explicit-any
  const ins: any = await (client.from("webhook_deliveries") as any).insert({
    endpoint_id: endpoint.id, event_type: event.event_type,
    event_id: event.event_id, payload: JSON.parse(body),
    attempt_number: attemptNumber, status: "pending",
  }).select("id").single();
  let delivery: DeliveryId;
  try { delivery = one<DeliveryId>(ins); }
  catch (e) {
    log.error("delivery insert failed", { endpoint_id: endpoint.id, error: String(e) });
    return { endpoint_id: endpoint.id, url: endpoint.url, ok: false, status: "failed", response_status: null, error: "delivery_insert_failed" };
  }

  const unixTs = Math.floor(Date.now() / 1000);
  const signature = await buildSignatureHeader(endpoint.secret, unixTs, body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json", "User-Agent": USER_AGENT,
    "X-Antarix-Event-Id": event.event_id, "X-Antarix-Event-Type": event.event_type,
    "X-Antarix-Delivery-Id": delivery.id, "X-Antarix-Signature": signature,
  };

  // POST with timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let responseStatus: number | null = null;
  let responseExcerpt: string | null = null;
  let errorMessage: string | null = null;
  let outcome: DispatchOutcome["status"] = "failed";
  try {
    const res = await fetch(endpoint.url, { method: "POST", headers, body, signal: controller.signal });
    responseStatus = res.status;
    responseExcerpt = (await res.text()).slice(0, RESPONSE_BODY_EXCERPT_MAX);
    if (res.status >= 200 && res.status < 300) outcome = "succeeded";
    else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) outcome = "exhausted";
    else outcome = "failed"; // 5xx, 408, 429, anything else → retry
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    outcome = "failed";
    log.warn("webhook fetch threw", { endpoint_id: endpoint.id, error: errorMessage });
  } finally { clearTimeout(timer); }

  // Update delivery row + endpoint state.
  const respondedAt = new Date().toISOString();
  // deno-lint-ignore no-explicit-any
  await (client.from("webhook_deliveries") as any).update({
    status: outcome, response_status: responseStatus,
    response_body_excerpt: responseExcerpt, error_message: errorMessage, responded_at: respondedAt,
  }).eq("id", delivery.id);

  // deno-lint-ignore no-explicit-any
  const upd = (patch: Record<string, unknown>) =>
    (client.from("webhook_endpoints") as any).update(patch).eq("id", endpoint.id);
  if (outcome === "succeeded") {
    await upd({ last_success_at: respondedAt, consecutive_failures: 0 });
  } else if (outcome === "failed") {
    const newFailures = endpoint.consecutive_failures + 1;
    const shouldDisable = newFailures >= AUTO_DISABLE_THRESHOLD;
    await upd({
      last_failure_at: respondedAt, consecutive_failures: newFailures,
      ...(shouldDisable ? { is_active: false } : {}),
    });
    if (shouldDisable) {
      log.warn("endpoint auto-disabled after repeated failures", {
        endpoint_id: endpoint.id, url: endpoint.url,
        consecutive_failures: newFailures, threshold: AUTO_DISABLE_THRESHOLD,
      });
    }
  } else {
    // exhausted: 4xx means the partner's URL is misconfigured; record
    // the failure timestamp but do NOT auto-disable.
    await upd({ last_failure_at: respondedAt });
  }

  log.info("webhook delivered", {
    endpoint_id: endpoint.id, event_type: event.event_type,
    event_id: event.event_id, delivery_id: delivery.id, outcome, response_status: responseStatus,
  });
  return {
    endpoint_id: endpoint.id, url: endpoint.url, ok: outcome === "succeeded",
    status: outcome, response_status: responseStatus,
    ...(errorMessage ? { error: errorMessage } : {}),
  };
}

// ----- retry cron ---------------------------------------------------------

/**
 * Re-dispatch every 'failed' row whose attempt_number < MAX_ATTEMPTS and
 * whose `requested_at` is older than the 30s minimum. Called hourly by a
 * cron (snippet in docs/webhooks.md §Open items).
 */
export async function retryFailedDeliveries(opts: DispatchOptions = {}): Promise<{ retried: number }> {
  const log = makeLogger(opts.ctx, opts.functionName ?? FUNCTION_NAME);
  const client = await _factory();
  const cutoffIso = new Date(Date.now() - RETRY_MIN_INTERVAL_MS).toISOString();

  // deno-lint-ignore no-explicit-any
  const sel: any = await (client.from("webhook_deliveries") as any)
    .select("id,endpoint_id,event_type,event_id,payload,attempt_number,requested_at")
    .eq("status", "failed")
    .lt("attempt_number", MAX_ATTEMPTS)
    .lt("requested_at", cutoffIso)
    .order("requested_at", { ascending: true })
    .limit(100);
  let rowsList: FailedRow[];
  try { rowsList = rows(sel) as FailedRow[]; }
  catch (e) { log.error("retry scan failed", { error: String(e) }); return { retried: 0 }; }

  if (rowsList.length === 0) { log.info("no deliveries to retry"); return { retried: 0 }; }

  let retried = 0;
  for (const row of rowsList) {
    // deno-lint-ignore no-explicit-any
    const epRes: any = await (client.from("webhook_endpoints") as any)
      .select("id,url,secret,consecutive_failures")
      .eq("id", row.endpoint_id).eq("is_active", true).single();
    let endpoint: EndpointRow;
    try { endpoint = one<EndpointRow>(epRes); }
    catch { continue; } // endpoint deleted or auto-disabled
    const body = JSON.stringify({ event_type: row.event_type, event_id: row.event_id, payload: row.payload });
    await dispatchOne(client, log, endpoint, { event_type: row.event_type as WebhookEventType, event_id: row.event_id, payload: row.payload }, body, row.attempt_number + 1, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    retried += 1;
  }
  log.info("retry batch complete", { retried, scanned: rowsList.length });
  return { retried };
}
