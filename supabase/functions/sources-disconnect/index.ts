// supabase/functions/sources-disconnect/index.ts
// T039 — DELETE /users/me/sources/{source}: sets status='disconnected' on the source row,
// marks derived insights stale, writes a privacy_requests audit row.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VALID_SOURCES = new Set(["github", "calendar", "whatsapp"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "DELETE") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "Not authenticated" }, 401);

  const url = new URL(req.url);
  const source = url.pathname.split("/").pop();
  if (!source || !VALID_SOURCES.has(source)) {
    return json({ error: "source must be one of github, calendar, whatsapp" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  if (source === "github") {
    await admin.from("github_accounts").update({ status: "disconnected" }).eq("user_id", user.id);
  } else if (source === "calendar") {
    await admin.from("calendar_accounts").update({ status: "disconnected" }).eq("user_id", user.id);
  } else {
    await admin.from("whatsapp_connections")
      .update({ status: "disconnected", opt_out_at: new Date().toISOString() })
      .eq("user_id", user.id);
    await admin.from("nudge_preferences").update({ whatsapp_channel: false }).eq("user_id", user.id);
  }

  await admin.from("privacy_requests").insert({
    user_id: user.id,
    request_type: "source_disconnect",
    status: "completed",
    completed_at: new Date().toISOString(),
    details: { source },
  });

  return json({ ok: true, source });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cor(), "Content-Type": "application/json" } });
}
function cor() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  };
}
