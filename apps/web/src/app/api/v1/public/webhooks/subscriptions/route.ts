// /api/v1/public/webhooks/subscriptions
// Create a webhook subscription. Requires API key with scope
// 'webhook:subscribe'. The plaintext signing secret is returned EXACTLY
// ONCE in the 201 response; only the bcrypt hash is persisted.
// See specs/004-eleven-of-ten/contracts/api.md

import "server-only";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyApiKeyFromHeader, hasScope } from "@/lib/api/apikey";
import { enforcePublicApiRateLimit } from "@/lib/api/rate-limit";
import {
  publicWebhookSubscribeSchema,
  parseOrError,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET_BYTES = 24; // -> 48 hex chars after the whsec_ prefix
const BCRYPT_COST = 10;

type ErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

function err(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): NextResponse<ErrorBody> {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (status === 401) {
    headers["WWW-Authenticate"] = 'Bearer realm="antarix-public-api"';
  }
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers[k] = v;
  }
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status, headers },
  );
}

function ratelimitHeaders(rate: {
  remaining: number;
  reset_at: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.floor(rate.reset_at / 1000)),
  };
}

export async function POST(req: Request) {
  try {
    const auth = await verifyApiKeyFromHeader(req.headers.get("authorization"));
    if (!auth.ok || !auth.key) {
      return err("unauthorized", "A valid API key is required.", 401);
    }
    if (!hasScope(auth.key, "webhook:subscribe")) {
      return err(
        "forbidden",
        "API key is missing scope webhook:subscribe.",
        403,
      );
    }

    const rate = await enforcePublicApiRateLimit(
      auth.key.id,
      auth.key.rate_limit_rpm,
    );
    if (!rate.ok) {
      const extraHeaders: Record<string, string> = {
        "Retry-After": String(Math.max(1, rate.retry_after_seconds)),
      };
      return err(
        "rate_limited",
        "Rate limit exceeded.",
        429,
        { retry_after_seconds: rate.retry_after_seconds },
        extraHeaders,
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = parseOrError(publicWebhookSubscribeSchema, body);
    if (!parsed.ok) {
      return err("invalid_input", parsed.error, 400, {
        issues: parsed.issues,
      });
    }

    // Mint the secret server-side. Plaintext is `whsec_<48-hex>`. The
    // bcrypt hash is the only thing persisted (column: secret_hash).
    // Lazy-import bcryptjs so the cold-start cost is paid only when a
    // subscription is actually being created (not on every public-API
    // request).
    const secretPlaintext = `whsec_${randomBytes(SECRET_BYTES).toString("hex")}`;
    const bcrypt = (await import("bcryptjs")).default;
    const secretHash = await bcrypt.hash(secretPlaintext, BCRYPT_COST);

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("webhook_subscriptions")
      .insert({
        api_key_id: auth.key.id,
        event: parsed.data.event,
        target_url: parsed.data.target_url,
        secret_hash: secretHash,
        active: true,
      })
      .select("id, event, target_url, created_at")
      .single();

    if (error) {
      console.error("v1/public/webhooks/subscriptions: insert failed", {
        apiKeyId: auth.key.id,
        error: error.message,
      });
      return err("internal_error", "Internal error", 500);
    }

    const out = data as {
      id: string;
      event: string;
      target_url: string;
      created_at: string;
    };

    return NextResponse.json(
      {
        subscription_id: out.id,
        event: out.event,
        target_url: out.target_url,
        secret: secretPlaintext,
        created_at: out.created_at,
      },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Antarix-Response-Source": "direct",
          ...ratelimitHeaders(rate),
        },
      },
    );
  } catch (e) {
    console.error("v1/public/webhooks/subscriptions: unexpected error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return err("internal_error", "Internal error", 500);
  }
}
