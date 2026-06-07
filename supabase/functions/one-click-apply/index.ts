// supabase/functions/one-click-apply/index.ts
// T074 — POST /applications: create a student_applications row that snapshots
// the current verifiable_credentials row.

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

  const { company_id, job_match_id, message } = await req.json() as { company_id?: string; job_match_id?: string; message?: string };
  if (!company_id) return json({ error: "company_id required" }, 400);

  // Snapshot the credential
  const { data: cred } = await supabase.from("verifiable_credentials")
    .select("id,public_slug,snapshot_overall_score,snapshot_per_skill,snapshot_activity_totals,snapshot_cohort_percentile,snapshot_taken_at,revocation_status")
    .eq("user_id", user.id).eq("revocation_status", "active")
    .order("snapshot_taken_at", { ascending: false }).limit(1).maybeSingle();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: row, error } = await admin.from("student_applications").insert({
    student_user_id: user.id,
    company_id,
    status: "submitted",
    credential_snapshot_id: cred?.id ?? null,
  }).select("id,status,credential_snapshot_id,applied_at").single();
  if (error) return json({ error: error.message }, 500);
  return json(row, 201);
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
