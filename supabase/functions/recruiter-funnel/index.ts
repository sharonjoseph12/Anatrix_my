// supabase/functions/recruiter-funnel/index.ts
// T092 helper — Returns Antarix-sourced hires for the calling recruiter.

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

  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: matches } = await supabase.from("job_matches")
    .select("id,interview_outcome,source")
    .eq("recruiter_user_id", user.id)
    .gte("created_at", since);
  const all = matches ?? [];
  const sourced = all.filter((m) => m.source === "antarix_search" || m.source === "antarix_invite").length;
  return json({ sourced, total: all.length, window_days: 90 });
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
