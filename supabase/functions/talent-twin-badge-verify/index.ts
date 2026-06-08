import { verifyBadge } from "../_shared/twin-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { withObservability } from "../_shared/observability.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const url = new URL(req.url);
  const badgeId = url.searchParams.get("badge_id");
  const jwt = url.searchParams.get("jwt");
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (!badgeId && !jwt) {
    return new Response(JSON.stringify({ error: "invalid_request", message: "Provide badge_id or jwt" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let resolvedBadgeId = badgeId;

  if (jwt) {
    const claims = verifyBadge(jwt);
    if (!claims) {
      return new Response(JSON.stringify({ verified: false, reason: "invalid_signature" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (Date.now() / 1000 > claims.exp) {
      return new Response(JSON.stringify({ verified: false, reason: "expired" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    resolvedBadgeId = resolvedBadgeId ?? claims.sub;
  }

  if (!resolvedBadgeId) {
    return new Response(JSON.stringify({ verified: false, reason: "not_found" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const { data: proof } = await client
    .from("authorship_proof")
    .select("id, student_id, confidence_score, verifiable_credential_url, status, completed_at")
    .eq("id", resolvedBadgeId)
    .single();

  if (!proof) {
    return new Response(JSON.stringify({ verified: false, reason: "not_found" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (proof.status === "revoked") {
    const { data: revocation } = await client
      .from("badge_revocations")
      .select("created_at")
      .eq("badge_id", resolvedBadgeId)
      .single();
    return new Response(JSON.stringify({ verified: false, reason: "revoked", revoked_at: revocation?.created_at ?? null, badge_id: resolvedBadgeId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: student } = await client.from("users").select("name").eq("id", proof.student_id).single();
  return new Response(JSON.stringify({
    verified: true,
    subject: { name: (student as Record<string, unknown>)?.name ?? "Unknown", id: proof.student_id },
    badge_id: proof.id,
    issued_at: proof.completed_at,
    confidence_score: proof.confidence_score,
    revoked: false,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export default withObservability(handler);
