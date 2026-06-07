// /api/v1/public/webhooks/subscriptions/[id]
// Soft-delete a webhook subscription owned by the calling API key. The
// row is kept (active=false) so webhook_deliveries audit history
// remains queryable. Returns 204 on success, 404 if the subscription
// does not exist OR is owned by a different key (no information
// disclosure). See specs/004-eleven-of-ten/contracts/api.md

import "server-only";
import { NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyApiKeyFromHeader, hasScope } from "@/lib/api/apikey";
import { enforcePublicApiRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function DELETE(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return err("invalid_input", "id must be a UUID.", 400);
    }

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

    const supabase = createSupabaseServiceClient();

    // Verify ownership before soft-deleting. We treat "not yours" as 404
    // (not 403) to avoid leaking the existence of other tenants'
    // subscriptions. The lookup returns the api_key_id column; we compare
    // server-side and never expose the mismatch.
    const { data: sub, error: subErr } = await supabase
      .from("webhook_subscriptions")
      .select("id, api_key_id, active")
      .eq("id", id)
      .maybeSingle();

    if (subErr) {
      console.error(
        "v1/public/webhooks/subscriptions/[id]: lookup failed",
        { id, error: subErr.message },
      );
      return err("internal_error", "Internal error", 500);
    }
    if (!sub || (sub as { api_key_id: string }).api_key_id !== auth.key.id) {
      return err("not_found", "Subscription not found.", 404);
    }
    if ((sub as { active: boolean }).active === false) {
      // Idempotent: already inactive. Return 204 (no body).
      return new NextResponse(null, {
        status: 204,
        headers: ratelimitHeaders(rate),
      });
    }

    // Soft-delete. Note: webhook_subscriptions in migration 037 has no
    // deleted_at column, so we set active=false to preserve the audit
    // trail. A future migration can add deleted_at if richer audit
    // queries are needed.
    const { error: updateErr } = await supabase
      .from("webhook_subscriptions")
      .update({ active: false })
      .eq("id", id)
      .eq("api_key_id", auth.key.id);

    if (updateErr) {
      console.error(
        "v1/public/webhooks/subscriptions/[id]: soft-delete failed",
        { id, error: updateErr.message },
      );
      return err("internal_error", "Internal error", 500);
    }

    return new NextResponse(null, {
      status: 204,
      headers: ratelimitHeaders(rate),
    });
  } catch (e) {
    console.error("v1/public/webhooks/subscriptions/[id]: unexpected error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return err("internal_error", "Internal error", 500);
  }
}
