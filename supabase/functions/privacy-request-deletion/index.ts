// supabase/functions/privacy-request-deletion/index.ts
// T098 — Soft-delete the user: mark deletion_requested_at = now(), set
// deletion_purge_after = now() + 30d, immediately revoke credentials and
// disable company_search_visible.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Missing Authorization" }, 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: ue } = await supabase.auth.getUser();
  if (ue || !user) return json({ error: "Not authenticated" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const purgeAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await admin.from("users").update({
    deletion_requested_at: new Date().toISOString(),
    deletion_purge_after: purgeAt,
    company_search_visible: false,
    whatsapp_opt_in: false,
    power_mode_active: false,
  }).eq("id", user.id);

  await admin.from("verifiable_credentials").update({
    revocation_status: "revoked", revoked_at: new Date().toISOString(),
  }).eq("user_id", user.id).eq("revocation_status", "active");

  await admin.from("privacy_requests").insert({
    user_id: user.id, request_type: "account_deletion", status: "pending",
    details: { purge_at: purgeAt },
  });

  return json({ ok: true, purge_at: purgeAt });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cor(), "Content-Type": "application/json" } });
}
function cor() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
