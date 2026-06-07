// supabase/functions/credential-vc-resolve/[did]/index.ts
// T-W3C-VC-RESOLVE: public DID resolver for did:web:antarix.app:c/<uuid>.
//
// PUBLIC — no JWT required; rate-limited at the gateway (B-3 will land the
// shared rate-limit wrapper; until then deploy this function with
// `--no-verify-jwt` and a CDN edge rate-limit in front).
//
// Path:    GET /functions/v1/credential-vc-resolve/<did>
//          (raw or percent-encoded — both forms are accepted)
// Returns the W3C DID Resolution v0.3 envelope plus the credential payload
// so DIF-compliant verifiers (veramo, vc-js, didkit) can resolve + verify
// in a single round trip.
//
// Local dev:  npx supabase functions serve credential-vc-resolve --no-verify-jwt
// Deploy:     npx supabase functions deploy credential-vc-resolve --no-verify-jwt
//
// Copy-paste template — see supabase/functions/health-check/index.ts.
//
// Response shape (W3C DID Resolution spec §1.3):
//   {
//     "didDocument":           { ... },
//     "didResolutionMetadata": { "contentType": "application/did+json" },
//     "didDocumentMetadata":   { "created": "...", "updated": "...", "deactivated": false },
//     "credential":            { ...W3C VC v2.0 envelope from build_vc_document... },
//     "credentialProof":       { ...DataIntegrityProof from sign_vc_document... }
//   }
// Status codes:
//   200  ok
//   400  malformed DID                      ({ error: "invalid_did" })
//   404  well-formed DID, credential not in verifiable_credentials
//        (body still carries the DID Resolution envelope with
//         didResolutionMetadata.error = "notFound")
//   410  credential is revoked              ({ error: "revoked",
//                                              revoked_at, reason,
//                                              didDocumentMetadata.deactivated: true })
//   500  unexpected DB error                ({ error: "db_error" })

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withObservability } from "../../_shared/observability.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const PATH_PREFIX = "/credential-vc-resolve/";
const DID_RE =
  /^did:web:antarix\.app:c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function didJsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type":
        'application/did+ld+json; profile="https://w3id.org/did-resolution"',
      // Edge cache: 60s for the happy path so verifier polling does not
      // hammer Postgres. Revoked / not-found responses set their own.
      "Cache-Control": "public, max-age=60",
    },
  });
}
function errRes(code: string, message: string, status: number, extra?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ error: code, message, ...(extra ?? {}) }),
    {
      status,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

function extractDid(url: URL): string | null {
  const idx = url.pathname.indexOf(PATH_PREFIX);
  if (idx < 0) return null;
  const raw = url.pathname.slice(idx + PATH_PREFIX.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

serve(
  withObservability("credential-vc-resolve", async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "GET") {
      return errRes("method_not_allowed", "Use GET.", 405);
    }

    const did = extractDid(new URL(req.url));
    if (!did || !DID_RE.test(did)) {
      ctx.log.warn("malformed did", { did });
      return errRes(
        "invalid_did",
        "DID must match did:web:antarix.app:c/<uuid>.",
        400,
      );
    }
    ctx.span.setAttribute("did", did);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Resolve the DID Document via the SECURITY DEFINER SQL function.
    const didDocSpan = ctx.span.startChild("rpc.resolve_did");
    const { data: didDocument, error: didErr } = await supabase.rpc(
      "resolve_did",
      { p_did: did },
    );
    didDocSpan.end();
    if (didErr) {
      ctx.log.error("resolve_did failed", { error: didErr.message });
      return errRes("db_error", didErr.message, 500);
    }

    // 2. Fetch the credential row keyed by did.
    const credSpan = ctx.span.startChild("db.select.verifiable_credentials");
    const { data: cred, error: credErr } = await supabase
      .from("verifiable_credentials")
      .select(
        "id,vc_document,vc_proof,issuance_date,expiration_date,updated_at,revocation_status",
      )
      .eq("did", did)
      .maybeSingle();
    credSpan.end();
    if (credErr) {
      ctx.log.error("credential lookup failed", { error: credErr.message });
      return errRes("db_error", credErr.message, 500);
    }
    if (!cred) {
      // Per W3C DID Resolution §1.4: signal absence with notFound in metadata
      // *and* HTTP 404 so dumb HTTP clients can short-circuit on status.
      return new Response(
        JSON.stringify({
          error: "not_found",
          message: "DID is well-formed but no credential with that DID exists.",
          didDocument: null,
          didResolutionMetadata: {
            contentType: "application/did+json",
            error: "notFound",
          },
          didDocumentMetadata: {},
        }),
        {
          status: 404,
          headers: {
            ...CORS,
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // 3. Revocation check. Two sources are honoured for backward-compat:
    //    a) the W3C-style vc_revocations table (032), and
    //    b) the legacy revocation_status enum column on verifiable_credentials (022).
    const revSpan = ctx.span.startChild("db.select.vc_revocations");
    const { data: rev, error: revErr } = await supabase
      .from("vc_revocations")
      .select("revoked_at,reason")
      .eq("credential_id", cred.id)
      .order("revoked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    revSpan.end();
    if (revErr) {
      ctx.log.error("revocation lookup failed", { error: revErr.message });
      return errRes("db_error", revErr.message, 500);
    }
    const revoked = !!rev || cred.revocation_status === "revoked";
    if (revoked) {
      ctx.log.info("vc resolved: revoked", { did, revoked_at: rev?.revoked_at });
      return errRes(
        "revoked",
        "Credential has been revoked.",
        410,
        {
          revoked_at: rev?.revoked_at ?? null,
          reason: rev?.reason ?? null,
          didDocument,
          didResolutionMetadata: { contentType: "application/did+json" },
          didDocumentMetadata: {
            deactivated: true,
            ...(rev?.revoked_at ? { deactivatedAt: rev.revoked_at } : {}),
          },
        },
      );
    }

    ctx.log.info("vc resolved", { did, credential_id: cred.id });
    return didJsonRes({
      didDocument,
      didResolutionMetadata: {
        contentType: "application/did+json",
      },
      didDocumentMetadata: {
        created: cred.issuance_date,
        updated: cred.updated_at ?? cred.issuance_date,
        deactivated: false,
        ...(cred.expiration_date ? { nextUpdate: cred.expiration_date } : {}),
      },
      credential: cred.vc_document,
      credentialProof: cred.vc_proof,
    }, 200);
  }),
);
