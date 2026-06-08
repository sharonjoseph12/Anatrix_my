// supabase/functions/_shared/rate-limit.ts
// v1 token-bucket rate-limit wrapper for the 28 Supabase Edge Functions.
// Pairs with _shared/observability.ts but does NOT depend on its runtime
// (only its types), so it can be used standalone. The atomic per-bucket
// consume happens server-side in public.rate_limit_consume (migration 033).
// See docs/rate-limiting.md.

import type { ObsContext } from "./observability.ts";

export interface RateLimitConfig {
  capacity: number;         // burst size, max tokens in the bucket
  refillPerSecond: number;  // sustained rate (tokens / sec)
  cost?: number;            // tokens consumed per call, default 1
}

// Recommended per-function configs. Keys are Edge Function directory names.
// "_default" is used for unknown function names (the wrapper never throws).
export const defaultConfigs: Readonly<Record<string, RateLimitConfig>> = Object.freeze({
  "nudge-dispatch":        { capacity: 30, refillPerSecond: 0.5 },    // 30 burst, ~30/min sustained
  "ai-coach":              { capacity: 10, refillPerSecond: 0.167 },  // 10 burst, 1 every 6s
  "credential-vc-resolve": { capacity: 60, refillPerSecond: 1 },      // 60 burst, 1/s (public resolve)
  "credential-vc-issue":   { capacity: 5,  refillPerSecond: 0.1 },    // 5 burst,  1 every 10s (expensive crypto)
  "whatsapp-send":         { capacity: 20, refillPerSecond: 0.333 },  // 20 burst, 1 every 3s
  "recruiter-search":      { capacity: 30, refillPerSecond: 0.5 },
  "_default":              { capacity: 60, refillPerSecond: 1 },
});

export type RateLimitedHandler = (req: Request) => Response | Promise<Response>;

// ----- supabase client (lazy, injectable) ---------------------------------

interface RpcRow { allowed: boolean; remaining_tokens: number; retry_after_seconds: number }
interface RpcResult { data: RpcRow[] | RpcRow | null; error: { message?: string } | null }
interface SupabaseLike { rpc(fn: string, params: Record<string, unknown>): Promise<RpcResult> }

let _cachedClient: Promise<SupabaseLike> | null = null;
let _factory: () => Promise<SupabaseLike> = defaultFactory;

async function defaultFactory(): Promise<SupabaseLike> {
  if (_cachedClient) return _cachedClient;
  _cachedClient = (async () => {
    // Dynamic import so unit tests that inject a stub never trigger the
    // network fetch of @supabase/supabase-js.
    const mod = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    // deno-lint-ignore no-explicit-any
    const denoEnv = (globalThis as any).Deno?.env;
    const url = denoEnv?.get("SUPABASE_URL") ?? "";
    const key = denoEnv?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    return mod.createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as SupabaseLike;
  })();
  return _cachedClient;
}

/** Test-only: inject a stub client. Pass `null` to restore the default. */
export function __setSupabaseFactoryForTesting(
  f: (() => SupabaseLike | Promise<SupabaseLike>) | null,
): void {
  _cachedClient = null;
  _factory = f
    ? (async () => await f())
    : defaultFactory;
}

// ----- config + key helpers -----------------------------------------------

function resolveConfig(fnName: string, override?: Partial<RateLimitConfig>): RateLimitConfig {
  const base = defaultConfigs[fnName] ?? defaultConfigs["_default"];
  return {
    capacity: override?.capacity ?? base.capacity,
    refillPerSecond: override?.refillPerSecond ?? base.refillPerSecond,
    cost: override?.cost ?? 1,
  };
}

function buildBucketKey(ctx: ObsContext, fnName: string): string {
  // LIMITATION: ObsContext does not carry the client IP, so unauthenticated
  // calls fall back to ctx.requestId — which is fresh per request, meaning
  // unauth callers get effectively no rate limit. See docs/rate-limiting.md
  // §"bucket_key format" for the v2 plan (gateway-injected x-real-ip).
  const identity = ctx.userId ? `user:${ctx.userId}` : `ip:${ctx.requestId}`;
  return `${identity}:fn:${fnName}`;
}

// ----- public API ---------------------------------------------------------

/**
 * Consume one (or `cfg.cost`) tokens from the bucket for this user+function.
 * Fail-open on any RPC error so a DB hiccup does not cascade into a 5xx
 * storm; the failure is logged via `ctx.log.warn` for downstream alerting.
 */
export async function checkRateLimit(
  ctx: ObsContext,
  fnName: string,
  cfg?: Partial<RateLimitConfig>,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const c = resolveConfig(fnName, cfg);
  const bucket = buildBucketKey(ctx, fnName);
  let res: RpcResult;
  try {
    const client = await _factory();
    res = await client.rpc("rate_limit_consume", {
      p_bucket_key:        bucket,
      p_capacity:          c.capacity,
      p_refill_per_second: c.refillPerSecond,
      p_cost:              c.cost,
    });
  } catch (err) {
    ctx.log.warn("rate_limit rpc threw; failing open", {
      bucket, error: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, remaining: c.capacity, retryAfter: 0 };
  }
  if (res.error) {
    ctx.log.warn("rate_limit rpc error; failing open", {
      bucket, error: res.error.message ?? "",
    });
    return { allowed: true, remaining: c.capacity, retryAfter: 0 };
  }
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  if (!row) {
    ctx.log.warn("rate_limit rpc returned no row; failing open", { bucket });
    return { allowed: true, remaining: c.capacity, retryAfter: 0 };
  }
  return {
    allowed: !!row.allowed,
    remaining: Number(row.remaining_tokens ?? 0),
    retryAfter: Number(row.retry_after_seconds ?? 0),
  };
}

/**
 * Compose-style outer wrapper. Intended usage in an Edge Function:
 *
 *   serve(withRateLimit("ai-coach", "ai-coach",
 *           withObservability("ai-coach", handler)));
 *
 * The order matters: rate-limit first, so a 429 short-circuits before any
 * observability span / handler work is done. The second arg is either a
 * key into `defaultConfigs` or a full `RateLimitConfig` override.
 */
export function withRateLimit(
  name: string,
  cfg: RateLimitConfig | keyof typeof defaultConfigs,
  handler: RateLimitedHandler,
): (req: Request) => Promise<Response> {
  const resolved: RateLimitConfig = typeof cfg === "string"
    ? resolveConfig(cfg)
    : { capacity: cfg.capacity, refillPerSecond: cfg.refillPerSecond, cost: cfg.cost ?? 1 };
  return async (req) => {
    const userId = tryExtractUserId(req);
    const requestId = req.headers.get("supabase-request-id")
      ?? req.headers.get("x-request-id")
      ?? crypto.randomUUID();
    const stubCtx: ObsContext = { log: _stubLogger, span: _stubSpan, requestId, userId };
    const r = await checkRateLimit(stubCtx, name, resolved);
    if (!r.allowed) {
      const retrySec = Math.max(1, Math.ceil(r.retryAfter));
      return new Response(
        JSON.stringify({ error: "rate_limited", retry_after: r.retryAfter }),
        {
          status: 429,
          headers: {
            "Content-Type":         "application/json",
            "Retry-After":          String(retrySec),
            "X-RateLimit-Remaining": String(Math.max(0, Math.floor(r.remaining))),
          },
        },
      );
    }
    return handler(req);
  };
}

// ----- private helpers ----------------------------------------------------

// Mirror of observability.ts:tryExtractUserId, inlined so this module can
// be used standalone (without observability wrapping the inner handler).
function tryExtractUserId(req: Request): string | undefined {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return undefined;
  const parts = m[1].split(".");
  if (parts.length < 2) return undefined;
  try {
    const pad = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    const obj = JSON.parse(atob(pad.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown };
    return typeof obj.sub === "string" ? obj.sub : undefined;
  } catch { return undefined; }
}

const _stubLogger: ObsContext["log"] = {
  info:  () => {},
  warn:  (m, f) => console.log(JSON.stringify({ level: "warn",  msg: m, source: "rate-limit", ...(f ?? {}) })),
  error: (m, f) => console.log(JSON.stringify({ level: "error", msg: m, source: "rate-limit", ...(f ?? {}) })),
};
const _stubSpan: ObsContext["span"] = {
  setAttribute: () => {}, recordException: () => {},
  startChild:   () => _stubSpan, end: () => {},
};
