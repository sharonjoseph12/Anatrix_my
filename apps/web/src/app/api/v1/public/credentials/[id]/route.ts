// /api/v1/public/credentials/[id]
// Public verifiable-credential read endpoint. Requires API key with scope
// 'read:verifiable_credential'. Returns the W3C VC v2.0 JSON-LD envelope
// from the vc_document column for any credential that is active and has
// a published vc_document. See specs/004-eleven-of-ten/contracts/api.md

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

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return err("invalid_input", "id must be a UUID.", 400);
    }

    const auth = await verifyApiKeyFromHeader(req.headers.get("authorization"));
    if (!auth.ok || !auth.key) {
      return err("unauthorized", "A valid API key is required.", 401);
    }
    if (!hasScope(auth.key, "read:verifiable_credential")) {
      return err(
        "forbidden",
        "API key is missing scope read:verifiable_credential.",
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

    // "Publicly resolvable" = vc_document is populated (the W3C envelope
    // was built by build_vc_document() in migration 032) AND the credential
    // is not revoked. The revocation flag is encoded as
    // revocation_status = 'revoked' (and revoked_at is also set as a
    // belt-and-braces). Both must hold for the credential to be served.
    const { data: cred, error: credErr } = await supabase
      .from("verifiable_credentials")
      .select("id, vc_document, revocation_status, revoked_at")
      .eq("id", id)
      .not("vc_document", "is", null)
      .eq("revocation_status", "active")
      .is("revoked_at", null)
      .maybeSingle();

    if (credErr) {
      console.error("v1/public/credentials: query failed", {
        id,
        error: credErr.message,
      });
      return err("internal_error", "Internal error", 500);
    }
    if (!cred) {
      return err(
        "not_found",
        "Credential not found or not publicly resolvable.",
        404,
      );
    }

    const c = cred as { id: string; vc_document: unknown };

    return NextResponse.json(c.vc_document, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Antarix-Response-Source": "direct",
        ...ratelimitHeaders(rate),
      },
    });
  } catch (e) {
    console.error("v1/public/credentials: unexpected error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return err("internal_error", "Internal error", 500);
  }
}
