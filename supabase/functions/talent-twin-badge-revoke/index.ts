import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { withObservability } from "../_shared/observability.ts";
import { withRateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized", message: "Invalid or expired JWT" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { badge_id, reason } = await req.json();
  if (!badge_id) {
    return new Response(JSON.stringify({ error: "invalid_request", message: "badge_id is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { data: proof } = await client
    .from("authorship_proof")
    .select("id, student_id, status")
    .eq("id", badge_id)
    .single();

  if (!proof) {
    return new Response(JSON.stringify({ error: "not_found", message: "Badge not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  if (proof.student_id !== user.id) {
    return new Response(JSON.stringify({ error: "forbidden", message: "You can only revoke your own badges" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const badgeNonce = crypto.randomUUID();
  const { error: revokeError } = await client.from("badge_revocations").insert({
    badge_nonce: badgeNonce,
    badge_id: badge_id,
    reason: reason ?? null,
    revoked_by: user.id,
  });

  if (revokeError) {
    return new Response(JSON.stringify({ error: "internal_error", message: revokeError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  await client.from("authorship_proof").update({ status: "revoked" }).eq("id", badge_id);

  return new Response(JSON.stringify({ revoked: true, badge_id, revoked_at: new Date().toISOString() }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withObservability(withRateLimit(handler, "talent-twin-badge-revoke"));
