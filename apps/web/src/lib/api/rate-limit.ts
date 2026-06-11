// apps/web/src/lib/api/rate-limit.ts
// Postgres-backed token-bucket rate limit for the public API.
//
// The atomic refill + consume happens in the `public.rate_limit_consume`
// function (see supabase/migrations/033_rate_limit.sql). This module is a
// thin wrapper that:
//   - builds the bucket key (`apikey:<id>:public_api`),
//   - maps capacity / refill_per_second from the per-key `rate_limit_rpm`,
//   - normalises the RPC row into the RateLimitResult shape used by the
//     `/v1/public/*` route handlers.
//
// On any RPC error we fail open (return ok=true) so a transient DB hiccup
// does not cascade into a 5xx storm. The caller is expected to log the
// failure via the observability layer; see supabase/functions/_shared/
// rate-limit.ts for the reference wrapper used by Edge Functions.

import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  reset_at: number;
  retry_after_seconds: number;
}

interface RateLimitConsumeRow {
  allowed?: boolean;
  remaining_tokens?: number | string;
  retry_after_seconds?: number | string;
}

export async function enforcePublicApiRateLimit(
  apiKeyId: string,
  limitRpm: number,
): Promise<RateLimitResult> {
  const safeLimit = Number.isFinite(limitRpm) && limitRpm > 0 ? limitRpm : 0;
  const bucketKey = `apikey:${apiKeyId}:public_api`;
  const capacity = safeLimit;
  const refillPerSecond = safeLimit / 60;

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.rpc("rate_limit_consume", {
    p_bucket_key: bucketKey,
    p_capacity: capacity,
    p_refill_per_second: refillPerSecond,
    p_cost: 1,
  });

  if (error) {
    return {
      ok: true,
      remaining: capacity,
      reset_at: Date.now(),
      retry_after_seconds: 0,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitConsumeRow | null;
  if (!row) {
    return {
      ok: true,
      remaining: capacity,
      reset_at: Date.now(),
      retry_after_seconds: 0,
    };
  }

  const allowed = !!row.allowed;
  const remainingRaw = row.remaining_tokens;
  const retryRaw = row.retry_after_seconds;

  const remaining = Math.max(0, Math.floor(Number(remainingRaw ?? 0)));
  const retryAfterSeconds = Math.max(0, Math.ceil(Number(retryRaw ?? 0)));
  const resetAt = Date.now() + retryAfterSeconds * 1000;

  return {
    ok: allowed,
    remaining,
    reset_at: resetAt,
    retry_after_seconds: allowed ? 0 : retryAfterSeconds,
  };
}
