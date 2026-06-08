import { NextResponse } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitOptions {
  /** Identifier — usually `user:${id}` or `ip:${ip}` */
  key: string;
  /** Max requests in the window */
  limit: number;
  /** Window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  entry.count += 1;
  const ok = entry.count <= limit;
  return { ok, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

export function rateLimitResponse(resetAt: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.round((resetAt - Date.now()) / 1000))),
        "X-RateLimit-Reset": String(Math.round(resetAt / 1000)),
      },
    },
  );
}

/** Aggressive GC so the map doesn't grow unbounded. */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}, 60_000).unref?.();
