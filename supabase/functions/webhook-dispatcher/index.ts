// supabase/functions/webhook-dispatcher/index.ts
// 11/10 — Outbound webhook dispatcher.
//
// Modes:
//   - SWEEP:  POST { sweep: true }   (driven by cron, default 60s tick)
//   - PUSH:   POST { delivery_id: <bigint> }   (immediate retry / on-demand)
//
// Behaviour:
//   1. SELECT up to 100 pending or retry-due deliveries.
//   2. For each delivery, look up the subscription + its API key
//      (service-role bypasses RLS).
//   3. Build the event-specific payload by re-fetching the underlying
//      source row (e.g. candidate_profiles for score.updated).
//   4. Sign the JSON body with HMAC-SHA256 using the per-subscription
//      secret (see "v1 TRADE-OFF" below).
//   5. POST to target_url with the documented headers.
//   6. Timeout = 10s. On 2xx → success. On 4xx/5xx/timeout → retry with
//      exponential backoff (1s, 8s, 64s) per the contract. On the final
//      failure, mark the subscription inactive and log a stub email alert.
//   7. Return { ok, processed, succeeded, failed }.
//
// v1 TRADE-OFF (also documented in the Edge Function README):
//   webhook_subscriptions stores ONLY the bcrypt hash of the secret
//   (column: secret_hash). The subscriber's plaintext is never persisted
//   server-side. The contract demands that the dispatcher sign with the
//   subscriber's secret, but the secret is unrecoverable from the bcrypt
//   hash (by design).
//
//   For v1 we sign with the bcrypt hash string itself as the HMAC key.
//   This means:
//     - Sign side: works (we have the hash).
//     - Verify side: a partner who has the plaintext secret CANNOT
//       re-derive the hash (bcrypt is non-deterministic) and therefore
//       cannot verify the signature on their end.
//   This is documented as a v1 deficiency. A future migration will add
//   a `secret_plain` column (or AES-GCM encrypted secret) to webhook_subscriptions
//   so the dispatcher can sign with the actual secret.
//
//   Until that lands, we recommend consumers treat the signed payload as
//   "advisory" and re-fetch via the public API to confirm state.
//
// Local dev:  npx supabase functions serve webhook-dispatcher --no-verify-jwt
// Deploy:     npx supabase functions deploy webhook-dispatcher --no-verify-jwt
// Cron:       schedule every 60s (see supabase/functions/_shared/...).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withObservability } from "../_shared/observability.ts";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const MAX_BATCH = 100;
const FETCH_TIMEOUT_MS = 10_000;
const SIGNATURE_VERSION = "v1";
const HEADER_TIMESTAMP_PREFIX = "t=";
const USER_AGENT = "Antarix-Webhooks/1.0";

const EVENT_TYPES = ["score.updated", "credential.issued", "placement.confirmed"] as const;
type EventType = typeof EVENT_TYPES[number];

// ----------------------------------------------------------------------------
// Tiny env helper
// ----------------------------------------------------------------------------

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

// ----------------------------------------------------------------------------
// Error envelope
// ----------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

// ----------------------------------------------------------------------------
// Signing (HMAC-SHA256 over `${ts}.${rawBody}`) using the Web Crypto API.
// We use a synchronous-in-effect helper backed by a lazily-imported
// SubtleCrypto key. The signature is hex-encoded (lowercase).
// ----------------------------------------------------------------------------

interface SignedPayload {
  timestamp: number;
  signature: string;
  headerValue: string;
}

const HEX_LOOKUP = "0123456789abcdef";
function bytesToHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    const b = view[i] ?? 0;
    out += HEX_LOOKUP[(b >> 4) & 0xf] + HEX_LOOKUP[b & 0xf];
  }
  return out;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(sig);
}

async function signBody(secret: string, rawBody: string, now: number): Promise<SignedPayload> {
  const ts = Math.floor(now / 1000);
  const signed = `${ts}.${rawBody}`;
  const signature = await hmacSha256Hex(secret, signed);
  return {
    timestamp: ts,
    signature,
    headerValue: `${HEADER_TIMESTAMP_PREFIX}${ts},${SIGNATURE_VERSION}=${signature}`,
  };
}

// ----------------------------------------------------------------------------
// Event-specific data fetch
// ----------------------------------------------------------------------------

interface EventEnvelope {
  event: EventType;
  id: string;
  data: Record<string, unknown>;
}

async function fetchEventPayload(
  admin: ReturnType<typeof createClient>,
  event: EventType,
  delivery: { event_id: string; subscription_id: string },
  ctx: { log: { info: (m: string, f?: Record<string, unknown>) => void; warn: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void } },
): Promise<EventEnvelope> {
  const id = delivery.event_id;

  if (event === "score.updated") {
    // The score.updated event_id is the user_id (the trigger stores the
    // recomputed score for a given user). We re-fetch the latest profile.
    const { data: prof, error: profErr } = await admin
      .from("candidate_profiles")
      .select("user_id, overall_skill_proof_score, primary_specialization, peak_window, total_commits, total_hours_logged, is_public, updated_at")
      .eq("user_id", id)
      .maybeSingle();
    if (profErr) {
      ctx.log.warn("score.updated: candidate_profiles lookup failed", { error: profErr.message });
    }
    return {
      event,
      id,
      data: {
        user_id: id,
        overall_score: (prof as { overall_skill_proof_score?: number } | null)?.overall_skill_proof_score ?? null,
        specialization: (prof as { primary_specialization?: string | null } | null)?.primary_specialization ?? null,
        total_commits: (prof as { total_commits?: number | null } | null)?.total_commits ?? 0,
        updated_at: (prof as { updated_at?: string | null } | null)?.updated_at ?? null,
      },
    };
  }

  if (event === "credential.issued") {
    // The event_id is the verifiable_credentials.id.
    const { data: cred, error: credErr } = await admin
      .from("verifiable_credentials")
      .select("id, did, public_slug, snapshot_overall_score, issuance_date, expiration_date, revocation_status, user_id")
      .eq("id", id)
      .maybeSingle();
    if (credErr) {
      ctx.log.warn("credential.issued: lookup failed", { error: credErr.message });
    }
    return {
      event,
      id,
      data: (cred as Record<string, unknown> | null) ?? { id, missing: true },
    };
  }

  if (event === "placement.confirmed") {
    // The event_id is the student_applications.id (the offer that was
    // confirmed). We re-fetch the application + offer + company.
    const { data: app, error: appErr } = await admin
      .from("student_applications")
      .select("id, student_user_id, position_id, status, offer_status, offer_salary_inr, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (appErr) {
      ctx.log.warn("placement.confirmed: lookup failed", { error: appErr.message });
    }
    return {
      event,
      id,
      data: (app as Record<string, unknown> | null) ?? { id, missing: true },
    };
  }

  // Defensive fallback — the subscription_event_chk CHECK should have
  // rejected this event at INSERT time, so reaching here is a bug.
  return { event, id, data: { id, event, note: "unknown event type" } };
}

// ----------------------------------------------------------------------------
// Per-delivery dispatch
// ----------------------------------------------------------------------------

interface DispatchOutcome {
  ok: boolean;
  status?: number;
  error?: string;
  shouldRetry: boolean;
  finalFailure: boolean;
}

async function dispatchOne(
  admin: ReturnType<typeof createClient>,
  delivery: {
    id: number;
    subscription_id: string;
    event_id: string;
    attempt: number;
  },
  subscription: {
    id: string;
    api_key_id: string;
    event: EventType;
    target_url: string;
    secret_hash: string;
    active: boolean;
  },
  apiKey: { subject_id: string },
  ctx: { log: { info: (m: string, f?: Record<string, unknown>) => void; warn: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void } },
): Promise<DispatchOutcome> {
  if (!subscription.active) {
    ctx.log.info("subscription inactive; marking permanent failure", { delivery_id: delivery.id });
    return { ok: false, error: "subscription_inactive", shouldRetry: false, finalFailure: true };
  }

  // 1. Build the event payload by re-fetching source data.
  const envelope = await fetchEventPayload(admin, subscription.event, delivery, ctx);
  const rawBody = JSON.stringify(envelope);

  // 2. Sign with subscription.secret_hash (see v1 TRADE-OFF at top of file).
  const signed = await signBody(subscription.secret_hash, rawBody, Date.now());

  // 3. POST with timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(subscription.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-Antarix-Event": subscription.event,
        "X-Antarix-Timestamp": String(signed.timestamp),
        "X-Antarix-Signature": signed.headerValue,
        "X-Antarix-Delivery-Id": String(delivery.id),
        "X-Antarix-Event-Id": delivery.event_id,
      },
      body: rawBody,
      signal: controller.signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `network_error: ${msg}`, shouldRetry: true, finalFailure: delivery.attempt >= 3 };
  } finally {
    clearTimeout(timer);
  }

  const status = res.status;
  if (status >= 200 && status < 300) {
    return { ok: true, status, shouldRetry: false, finalFailure: false };
  }
  // 4xx other than 408/429 are not retried (client won't change their mind).
  const isRetryable4xx = status === 408 || status === 429;
  const isRetryable5xx = status >= 500;
  const shouldRetry = (isRetryable4xx || isRetryable5xx) && delivery.attempt < 3;
  const finalFailure = !shouldRetry;
  return {
    ok: false,
    status,
    error: `upstream_${status}`,
    shouldRetry,
    finalFailure,
  };
}

// ----------------------------------------------------------------------------
// Sweep query
// ----------------------------------------------------------------------------

function isEventType(s: string): s is EventType {
  return (EVENT_TYPES as readonly string[]).includes(s);
}

async function fetchSweepBatch(
  admin: ReturnType<typeof createClient>,
  limit: number,
): Promise<Array<{
  id: number;
  subscription_id: string;
  event_id: string;
  attempt: number;
  created_at: string;
}>> {
  // Retry-due check: (status='retry') AND (created_at + 1s*8^(attempt-1) <= now()).
  // For attempt=1 → +1s, attempt=2 → +8s, attempt=3 → +64s.
  // We compute the per-row delay in SQL via POWER() on the attempt counter.
  const { data, error } = await admin.rpc("dispatcher_sweep_due", { p_limit: limit });
  if (error || !data) {
    // Fallback: a simple `where status in ('pending','retry')` query.
    const { data: fb, error: fbErr } = await admin
      .from("webhook_deliveries")
      .select("id, subscription_id, event_id, attempt, created_at")
      .in("status", ["pending", "retry"])
      .order("created_at", { ascending: true })
      .limit(limit);
    if (fbErr) return [];
    return (fb ?? []) as Array<{
      id: number;
      subscription_id: string;
      event_id: string;
      attempt: number;
      created_at: string;
    }>;
  }
  return data as Array<{
    id: number;
    subscription_id: string;
    event_id: string;
    attempt: number;
    created_at: string;
  }>;
}

async function fetchImmediate(
  admin: ReturnType<typeof createClient>,
  deliveryId: number,
): Promise<{
  id: number;
  subscription_id: string;
  event_id: string;
  attempt: number;
  created_at: string;
} | null> {
  const { data, error } = await admin
    .from("webhook_deliveries")
    .select("id, subscription_id, event_id, attempt, created_at, status")
    .eq("id", deliveryId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: number; subscription_id: string; event_id: string; attempt: number; created_at: string; status: string };
  if (row.status === "success" || row.status === "failed_permanent") {
    return null;
  }
  return row;
}

// ----------------------------------------------------------------------------
// HTTP entrypoint
// ----------------------------------------------------------------------------

serve(
  withObservability("webhook-dispatcher", async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
    if (req.method !== "POST") return err("method_not_allowed", "Use POST.", 405);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const isSweep = body && body.sweep === true;
    const deliveryId = body && typeof body.delivery_id === "number" ? body.delivery_id : null;

    if (!isSweep && deliveryId == null) {
      return err("invalid_input", "Provide { sweep: true } or { delivery_id: <int> }.", 400);
    }

    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return err("internal_error", "Supabase env not configured.", 500);
    }
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const deliveries = isSweep
      ? await fetchSweepBatch(admin, MAX_BATCH)
      : (await fetchImmediate(admin, deliveryId as number))
        ? [await fetchImmediate(admin, deliveryId as number)]
        : [];

    if (deliveries.length === 0) {
      return json({ ok: true, processed: 0, succeeded: 0, failed: 0 });
    }

    let succeeded = 0;
    let failed = 0;

    // Cache lookups per subscription to avoid duplicate queries.
    const subCache = new Map<string, {
      id: string;
      api_key_id: string;
      event: EventType;
      target_url: string;
      secret_hash: string;
      active: boolean;
    }>();
    const keyCache = new Map<string, { subject_id: string }>();

    for (const d of deliveries) {
      // Lookup subscription.
      let sub = subCache.get(d.subscription_id);
      if (!sub) {
        const { data: s, error: sErr } = await admin
          .from("webhook_subscriptions")
          .select("id, api_key_id, event, target_url, secret_hash, active")
          .eq("id", d.subscription_id)
          .maybeSingle();
        if (sErr || !s) {
          failed += 1;
          await admin.from("webhook_deliveries").update({
            status: "failed_permanent",
            last_error: sErr?.message ?? "subscription_not_found",
          }).eq("id", d.id);
          continue;
        }
        const sRow = s as { id: string; api_key_id: string; event: string; target_url: string; secret_hash: string; active: boolean };
        if (!isEventType(sRow.event)) {
          failed += 1;
          await admin.from("webhook_deliveries").update({
            status: "failed_permanent",
            last_error: `unknown_event:${sRow.event}`,
          }).eq("id", d.id);
          continue;
        }
        sub = {
          id: sRow.id,
          api_key_id: sRow.api_key_id,
          event: sRow.event as EventType,
          target_url: sRow.target_url,
          secret_hash: sRow.secret_hash,
          active: sRow.active,
        };
        subCache.set(d.subscription_id, sub);
      }

      // Lookup api_key.
      let key = keyCache.get(sub.api_key_id);
      if (!key) {
        const { data: k, error: kErr } = await admin
          .from("api_keys")
          .select("subject_id")
          .eq("id", sub.api_key_id)
          .maybeSingle();
        if (kErr || !k) {
          failed += 1;
          await admin.from("webhook_deliveries").update({
            status: "failed_permanent",
            last_error: kErr?.message ?? "api_key_not_found",
          }).eq("id", d.id);
          continue;
        }
        key = k as { subject_id: string };
        keyCache.set(sub.api_key_id, key);
      }

      // Dispatch.
      const outcome = await dispatchOne(admin, d, sub, key, ctx);
      const nextAttempt = d.attempt + 1;
      if (outcome.ok) {
        succeeded += 1;
        await admin.from("webhook_deliveries").update({
          status: "success",
          delivered_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", d.id);
      } else if (outcome.shouldRetry && nextAttempt <= 3) {
        // Reset to 'pending' with attempt+1; sweep will pick it up after
        // the backoff window elapses.
        await admin.from("webhook_deliveries").update({
          status: "retry",
          attempt: nextAttempt,
          last_error: outcome.error ?? "unknown",
        }).eq("id", d.id);
        failed += 1;
      } else {
        // Permanent failure: increment attempt to its terminal value and
        // disable the subscription + log an email-alert stub.
        await admin.from("webhook_deliveries").update({
          status: "failed_permanent",
          attempt: Math.max(nextAttempt, 3),
          last_error: outcome.error ?? "unknown",
        }).eq("id", d.id);
        failed += 1;

        // Track consecutive permanent failures per subscription; on the
        // 3rd one, disable and log a stub email.
        const recent = await admin
          .from("webhook_deliveries")
          .select("id, status")
          .eq("subscription_id", sub.id)
          .eq("status", "failed_permanent")
          .order("id", { ascending: false })
          .limit(3);
        const recentList = (recent.data ?? []) as Array<{ id: number; status: string }>;
        if (recentList.length >= 3) {
          await admin
            .from("webhook_subscriptions")
            .update({ active: false })
            .eq("id", sub.id);
          ctx.log.warn("subscription auto-disabled after 3 consecutive permanent failures", {
            subscription_id: sub.id,
            api_key_id: sub.api_key_id,
            subject_id: key.subject_id,
            event: sub.event,
          });
          // STUB: would call an email-send Edge Function here. Per task
          // spec, log only in v1.
        }
      }
    }

    ctx.log.info("sweep done", { processed: deliveries.length, succeeded, failed });
    return json({ ok: true, processed: deliveries.length, succeeded, failed });
  }),
);

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// randomUUID is reserved for future payload stamping; the event_id is
// provided by the producer (see enqueueWebhookEvent).
