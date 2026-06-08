// supabase/functions/credential-vc-issue/index.ts
// T-W3C-VC-ISSUE: issue a W3C Verifiable Credential v2.0 for an existing
// public.verifiable_credentials row. Chains the three SQL functions added
// in migration 032_w3c_vc.sql:
//   1. public.build_vc_document(credential_id)        -> JSON-LD envelope
//   2. public.sign_vc_document (credential_id, kid)   -> Data Integrity proof
//   3. UPDATE verifiable_credentials SET vc_document, vc_proof, did,
//      issuance_date, expiration_date
//
// Auth: requires a Supabase JWT; the caller's `sub` MUST own the credential.
//       The Supabase service-role client is used for the DB read + write
//       because the three SQL helpers are SECURITY DEFINER and we need to
//       bypass RLS on the UPDATE. Ownership is enforced *here* in addition
//       to the existing RLS policy.
//
// Idempotency: if `vc_document` is already set on the row, the function
//       returns 409. Re-issuance is intentionally an admin-only path
//       (cycle the column back to NULL via SQL and call again).
//
// Local dev:  npx supabase functions serve credential-vc-issue
// Deploy:     npx supabase functions deploy credential-vc-issue
//
// Copy-paste template — see supabase/functions/health-check/index.ts.
//
// Request:  POST /functions/v1/credential-vc-issue
//           headers: Authorization: Bearer <user-jwt>
//           body:    { "credential_id": "<uuid>" }   (or ?credential_id=<uuid>)
// Response: 200 { "did", "vc_document", "vc_proof" }
//           400 { "error": "invalid_request",  "message": "..." }
//           401 { "error": "unauthorized",     "message": "..." }
//           404 { "error": "not_found",        "message": "..." }
//           409 { "error": "already_issued",   "message": "..." }
//           500 { "error": "no_issuer_key" | "build_failed" | "sign_failed" | "db_error", "message": "..." }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withObservability } from "../_shared/observability.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TWO_YEARS_MS = 2 * 365 * 24 * 3600 * 1000;

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function errRes(code: string, message: string, status: number): Response {
  return jsonRes({ error: code, message }, status);
}

serve(
  withObservability("credential-vc-issue", async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") {
      return errRes("method_not_allowed", "Use POST.", 405);
    }
    if (!ctx.userId) {
      ctx.log.warn("missing or unparsable bearer JWT");
      return errRes("unauthorized", "Missing or invalid bearer token.", 401);
    }

    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return errRes("invalid_request", "Body must be valid JSON.", 400);
    }
    const fromBody = typeof body.credential_id === "string" ? body.credential_id : undefined;
    const fromQuery = new URL(req.url).searchParams.get("credential_id") ?? undefined;
    const credentialId = fromBody ?? fromQuery ?? undefined;
    if (!credentialId || !UUID_RE.test(credentialId)) {
      return errRes("invalid_request", "credential_id must be a UUID.", 400);
    }
    ctx.span.setAttribute("credential_id", credentialId);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Ownership + idempotency check.
    const fetchSpan = ctx.span.startChild("db.select.verifiable_credentials");
    const { data: row, error: fetchErr } = await supabase
      .from("verifiable_credentials")
      .select("id,user_id,did,vc_document,issuance_date,expiration_date,snapshot_taken_at")
      .eq("id", credentialId)
      .maybeSingle();
    fetchSpan.end();
    if (fetchErr) {
      ctx.log.error("select verifiable_credentials failed", { error: fetchErr.message });
      return errRes("db_error", fetchErr.message, 500);
    }
    if (!row || row.user_id !== ctx.userId) {
      // Do not differentiate between "not found" and "not owned" — leaking
      // existence of a foreign credential UUID is a privacy regression.
      ctx.log.warn("credential not found or not owned", {
        credential_id: credentialId,
        owner_match: !!row,
      });
      return errRes("not_found", "Credential not found.", 404);
    }
    if (row.vc_document) {
      return errRes(
        "already_issued",
        "Credential already has a vc_document. Reissuance requires admin action.",
        409,
      );
    }

    // Pick the active (earliest) issuer key. Matches the same selection
    // rule used by public.resolve_did so the verificationMethod on the
    // proof always resolves on the DID Document side.
    const keySpan = ctx.span.startChild("db.select.vc_issuer_keys");
    const { data: key, error: keyErr } = await supabase
      .from("vc_issuer_keys")
      .select("kid")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    keySpan.end();
    if (keyErr) {
      ctx.log.error("vc_issuer_keys lookup failed", { error: keyErr.message });
      return errRes("db_error", keyErr.message, 500);
    }
    if (!key) {
      return errRes(
        "no_issuer_key",
        "vc_issuer_keys is empty; seed at least one EdDSA key before issuing.",
        500,
      );
    }
    ctx.span.setAttribute("kid", key.kid);

    // Build + sign via the SECURITY DEFINER SQL helpers.
    const buildSpan = ctx.span.startChild("rpc.build_vc_document");
    const { data: vcDoc, error: buildErr } = await supabase.rpc(
      "build_vc_document",
      { p_credential_id: credentialId },
    );
    buildSpan.end();
    if (buildErr || !vcDoc) {
      ctx.log.error("build_vc_document failed", { error: buildErr?.message });
      return errRes("build_failed", buildErr?.message ?? "build_vc_document returned null.", 500);
    }

    const signSpan = ctx.span.startChild("rpc.sign_vc_document");
    const { data: vcProof, error: signErr } = await supabase.rpc(
      "sign_vc_document",
      { p_credential_id: credentialId, p_kid: key.kid },
    );
    signSpan.end();
    if (signErr || !vcProof) {
      ctx.log.error("sign_vc_document failed", { error: signErr?.message });
      return errRes("sign_failed", signErr?.message ?? "sign_vc_document returned null.", 500);
    }

    // Persist. `did` is only set when NULL (migration 032 backfills it,
    // but a hand-inserted row could still arrive without one).
    const nowIso = new Date().toISOString();
    const did = row.did ?? `did:web:antarix.app:c/${row.id}`;
    const issuance = row.issuance_date ?? row.snapshot_taken_at ?? nowIso;
    const expiration =
      row.expiration_date ??
      new Date(Date.parse(issuance) + TWO_YEARS_MS).toISOString();

    const updSpan = ctx.span.startChild("db.update.verifiable_credentials");
    const { error: updErr } = await supabase
      .from("verifiable_credentials")
      .update({
        vc_document: vcDoc,
        vc_proof: vcProof,
        did,
        issuance_date: issuance,
        expiration_date: expiration,
      })
      .eq("id", credentialId);
    updSpan.end();
    if (updErr) {
      ctx.log.error("update verifiable_credentials failed", { error: updErr.message });
      return errRes("db_error", updErr.message, 500);
    }

    ctx.log.info("vc issued", {
      credential_id: credentialId,
      did,
      kid: key.kid,
      issuance_date: issuance,
      expiration_date: expiration,
    });
    return jsonRes({ did, vc_document: vcDoc, vc_proof: vcProof }, 200);
  }),
);
