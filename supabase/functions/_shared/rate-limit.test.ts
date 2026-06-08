// supabase/functions/_shared/rate-limit.test.ts
// v1 tests for the token-bucket rate-limit wrapper.
//
// Run:
//   deno test supabase/functions/_shared/rate-limit.test.ts
// or from the repo root:
//   deno test
//
// We stub `supabase.rpc('rate_limit_consume', …)` with an in-process token
// bucket that mirrors migration 033's SQL function. The SQL function itself
// is out of scope here (it needs a live Postgres); the stub lets us verify
// that the Deno wrapper plumbs allowed / remaining / retry_after correctly,
// that 429s carry Retry-After, that bucket keys are isolated, and that the
// default-config fallback is used for unknown function names.

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __setSupabaseFactoryForTesting,
  checkRateLimit,
  defaultConfigs,
  type RateLimitConfig,
  withRateLimit,
} from "./rate-limit.ts";
import type { ObsContext } from "./observability.ts";

// ----- shared test helpers ------------------------------------------------

interface FakeBucket {
  tokens: number;
  lastRefillMs: number;
  capacity: number;
  rate: number;
}

interface RpcCall {
  fn: string;
  params: Record<string, unknown>;
}

function makeInMemoryStub(opts: { now?: () => number } = {}) {
  const now = opts.now ?? (() => Date.now());
  const buckets = new Map<string, FakeBucket>();
  const calls: RpcCall[] = [];
  return {
    calls,
    buckets,
    rpc(fn: string, params: Record<string, unknown>) {
      calls.push({ fn, params: { ...params } });
      if (fn !== "rate_limit_consume") {
        return Promise.resolve({ data: null, error: { message: `unknown rpc: ${fn}` } });
      }
      const key  = String(params.p_bucket_key);
      const cap  = Number(params.p_capacity);
      const rate = Number(params.p_refill_per_second);
      const cost = Number(params.p_cost ?? 1);
      const t = now();
      let b = buckets.get(key);
      if (!b) {
        b = { tokens: cap, lastRefillMs: t, capacity: cap, rate };
        buckets.set(key, b);
      } else {
        b.capacity = cap;
        b.rate     = rate;
      }
      const elapsedSec = Math.max(0, (t - b.lastRefillMs) / 1000);
      const refilled   = Math.min(cap, b.tokens + elapsedSec * rate);
      b.lastRefillMs   = t;
      if (refilled >= cost) {
        b.tokens = refilled - cost;
        return Promise.resolve({
          data: [{ allowed: true, remaining_tokens: b.tokens, retry_after_seconds: 0 }],
          error: null,
        });
      }
      b.tokens = refilled;
      const retry = rate > 0 ? (cost - refilled) / rate : 9999;
      return Promise.resolve({
        data: [{ allowed: false, remaining_tokens: refilled, retry_after_seconds: retry }],
        error: null,
      });
    },
  };
}

function makeCtx(opts: { userId?: string; requestId?: string } = {}): ObsContext {
  const logs: Array<{ level: string; msg: string; fields?: Record<string, unknown> }> = [];
  const noopSpan = {
    setAttribute:    () => {},
    recordException: () => {},
    startChild:      () => noopSpan,
    end:             () => {},
  };
  const ctx = {
    log: {
      info:  (msg: string, fields?: Record<string, unknown>) => logs.push({ level: "info",  msg, fields }),
      warn:  (msg: string, fields?: Record<string, unknown>) => logs.push({ level: "warn",  msg, fields }),
      error: (msg: string, fields?: Record<string, unknown>) => logs.push({ level: "error", msg, fields }),
    },
    span: noopSpan,
    requestId: opts.requestId ?? "req-test",
    userId:    opts.userId,
  } as unknown as ObsContext;
  // deno-lint-ignore no-explicit-any
  (ctx as any).__logs = logs;
  return ctx;
}

// ----- tests --------------------------------------------------------------

Deno.test("checkRateLimit: first call within capacity is allowed", async () => {
  const stub = makeInMemoryStub();
  __setSupabaseFactoryForTesting(() => stub);
  try {
    const ctx = makeCtx({ userId: "u1" });
    const r = await checkRateLimit(ctx, "ai-coach");
    assertEquals(r.allowed, true);
    assertEquals(r.retryAfter, 0);
    // ai-coach default capacity is 10; one consumed → 9 remaining.
    assertEquals(r.remaining, defaultConfigs["ai-coach"].capacity - 1);
    // The bucket key must follow user:<id>:fn:<name>.
    assertEquals(stub.calls.length, 1);
    assertEquals(stub.calls[0].params.p_bucket_key, "user:u1:fn:ai-coach");
    assertEquals(stub.calls[0].params.p_capacity, defaultConfigs["ai-coach"].capacity);
    assertEquals(stub.calls[0].params.p_refill_per_second, defaultConfigs["ai-coach"].refillPerSecond);
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});

Deno.test("checkRateLimit: burst exhausted → !allowed with retryAfter > 0", async () => {
  const fixedNow = 1_700_000_000_000;
  const stub = makeInMemoryStub({ now: () => fixedNow });
  __setSupabaseFactoryForTesting(() => stub);
  try {
    const ctx = makeCtx({ userId: "burst-user" });
    const cfg: Partial<RateLimitConfig> = { capacity: 3, refillPerSecond: 1 };
    // Drain the bucket.
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(ctx, "fake-fn", cfg);
      assertEquals(r.allowed, true, `call ${i + 1} should be allowed`);
    }
    // 4th call must be denied with a positive retry-after.
    const denied = await checkRateLimit(ctx, "fake-fn", cfg);
    assertEquals(denied.allowed, false);
    assert(denied.retryAfter > 0, `retryAfter should be > 0, got ${denied.retryAfter}`);
    // remaining is the refilled (= 0 here) token count.
    assertEquals(denied.remaining, 0);
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});

Deno.test("checkRateLimit: refill works (50 ms at 100/s → ~5 tokens)", async () => {
  // Use a controllable clock so the test is deterministic on slow CI.
  let t = 1_700_000_000_000;
  const stub = makeInMemoryStub({ now: () => t });
  __setSupabaseFactoryForTesting(() => stub);
  try {
    const ctx = makeCtx({ userId: "refill-user" });
    const cfg: Partial<RateLimitConfig> = { capacity: 5, refillPerSecond: 100 };
    // Drain.
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(ctx, "refill-fn", cfg);
      assertEquals(r.allowed, true);
    }
    // Should now be denied.
    const denied = await checkRateLimit(ctx, "refill-fn", cfg);
    assertEquals(denied.allowed, false);
    // Advance virtual clock by 50 ms → refill of 50/1000 * 100 = 5 tokens.
    t += 50;
    const after = await checkRateLimit(ctx, "refill-fn", cfg);
    assertEquals(after.allowed, true, "should be allowed after 50 ms of refill");
    // Capacity caps at 5; one consumed → 4 remaining.
    assertEquals(Math.round(after.remaining), 4);
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});

Deno.test("checkRateLimit: different bucket keys are independent", async () => {
  const stub = makeInMemoryStub();
  __setSupabaseFactoryForTesting(() => stub);
  try {
    const cfg: Partial<RateLimitConfig> = { capacity: 1, refillPerSecond: 0.01 };
    const ctxA = makeCtx({ userId: "alice" });
    const ctxB = makeCtx({ userId: "bob" });
    // Drain alice.
    const a1 = await checkRateLimit(ctxA, "shared-fn", cfg);
    assertEquals(a1.allowed, true);
    const a2 = await checkRateLimit(ctxA, "shared-fn", cfg);
    assertEquals(a2.allowed, false);
    // Bob is unaffected.
    const b1 = await checkRateLimit(ctxB, "shared-fn", cfg);
    assertEquals(b1.allowed, true);
    // Same user, different function → also independent.
    const a3 = await checkRateLimit(ctxA, "other-fn", cfg);
    assertEquals(a3.allowed, true);
    // Sanity: three distinct bucket_keys observed.
    const keys = new Set(stub.calls.map((c) => c.params.p_bucket_key));
    assertEquals(keys.size, 3);
    assert(keys.has("user:alice:fn:shared-fn"));
    assert(keys.has("user:bob:fn:shared-fn"));
    assert(keys.has("user:alice:fn:other-fn"));
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});

Deno.test("checkRateLimit: unknown fn name falls back to _default config", async () => {
  const stub = makeInMemoryStub();
  __setSupabaseFactoryForTesting(() => stub);
  try {
    const ctx = makeCtx({ userId: "u-unknown" });
    const r = await checkRateLimit(ctx, "nonexistent-fn");
    assertEquals(r.allowed, true);
    assertEquals(stub.calls[0].params.p_capacity, defaultConfigs["_default"].capacity);
    assertEquals(
      stub.calls[0].params.p_refill_per_second,
      defaultConfigs["_default"].refillPerSecond,
    );
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});

Deno.test("checkRateLimit: unauthenticated falls back to ip:<requestId> identity", async () => {
  const stub = makeInMemoryStub();
  __setSupabaseFactoryForTesting(() => stub);
  try {
    const ctx = makeCtx({ requestId: "req-abc-123" }); // no userId
    await checkRateLimit(ctx, "ai-coach");
    assertEquals(stub.calls[0].params.p_bucket_key, "ip:req-abc-123:fn:ai-coach");
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});

Deno.test("checkRateLimit: rpc error fails open (allow + warn log)", async () => {
  __setSupabaseFactoryForTesting(() => ({
    rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }),
  }));
  try {
    const ctx = makeCtx({ userId: "u-err" });
    const r = await checkRateLimit(ctx, "ai-coach");
    assertEquals(r.allowed, true, "must fail open on RPC error");
    // deno-lint-ignore no-explicit-any
    const logs = (ctx as any).__logs as Array<{ level: string; msg: string }>;
    const warn = logs.find((l) => l.level === "warn");
    assertExists(warn, "expected a warn log on RPC error");
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});

Deno.test("withRateLimit: passes through when allowed, returns 429 when denied", async () => {
  let t = 1_700_000_000_000;
  const stub = makeInMemoryStub({ now: () => t });
  __setSupabaseFactoryForTesting(() => stub);
  try {
    let inner = 0;
    const inner_handler = () => {
      inner += 1;
      return new Response("ok", { headers: { "Content-Type": "text/plain" } });
    };
    const cfg: RateLimitConfig = { capacity: 2, refillPerSecond: 0.01 };
    const wrapped = withRateLimit("burst-fn", cfg, inner_handler);

    // Anonymous request → identity becomes ip:<reqid>; the wrapper synthesizes
    // a fresh request id per call, so anonymous callers get an effectively
    // un-shared bucket. Use an x-request-id header to keep the bucket stable
    // across the two calls of this test.
    const headers = { "x-request-id": "rid-burst" };
    const r1 = await wrapped(new Request("https://x/", { headers }));
    assertEquals(r1.status, 200);
    const r2 = await wrapped(new Request("https://x/", { headers }));
    assertEquals(r2.status, 200);
    const r3 = await wrapped(new Request("https://x/", { headers }));
    assertEquals(r3.status, 429);
    assertEquals(r3.headers.get("Content-Type"), "application/json");
    const retryAfterHeader = r3.headers.get("Retry-After");
    assertExists(retryAfterHeader, "Retry-After header must be set on 429");
    assert(Number(retryAfterHeader) >= 1);
    const body = await r3.json() as { error: string; retry_after: number };
    assertEquals(body.error, "rate_limited");
    assert(body.retry_after > 0);
    // Inner handler ran only for the two allowed calls.
    assertEquals(inner, 2);
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});

Deno.test("withRateLimit: accepts a defaultConfigs key as cfg", async () => {
  const stub = makeInMemoryStub();
  __setSupabaseFactoryForTesting(() => stub);
  try {
    const wrapped = withRateLimit(
      "ai-coach",
      "ai-coach",
      () => new Response("ok"),
    );
    const res = await wrapped(new Request("https://x/", {
      headers: { "x-request-id": "rid-keycfg" },
    }));
    assertEquals(res.status, 200);
    assertEquals(stub.calls[0].params.p_capacity, defaultConfigs["ai-coach"].capacity);
  } finally {
    __setSupabaseFactoryForTesting(null);
  }
});
