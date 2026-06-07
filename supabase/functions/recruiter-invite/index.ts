// supabase/functions/recruiter-invite/index.ts
// T088 — POST /job-matches/invite: creates a job_matches row in 'reached_out' state,
// enqueues a 'verification' nudge to the student, transitions to 'interview_proposed' on acceptance.

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

  const { student_user_id, role_title, message, slot_url } = await req.json() as { student_user_id?: string; role_title?: string; message?: string; slot_url?: string };
  if (!student_user_id) return json({ error: "student_user_id required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: jobMatch, error: insErr } = await admin.from("job_matches").insert({
    student_user_id,
    recruiter_user_id: user.id,
    role_title: role_title ?? null,
    message: message ?? null,
    status: "reached_out",
    interview_scheduling_state: slot_url ? "awaiting_acceptance" : "none",
  }).select("id,status,created_at").single();
  if (insErr) return json({ error: insErr.message }, 500);

  // Fire a verification nudge so the student sees the invite
  await admin.from("nudges").insert({
    user_id: student_user_id,
    type: "verification",
    channel: "whatsapp",
    template_id: "JOB_MATCH_INVITE",
    trigger_source: "event_commit",
    delivery_status: "queued",
    personalization_context: { job_match_id: jobMatch.id, role_title, message, slot_url },
    rendered_body: "",
    send_after: new Date().toISOString(),
  });
  return json(jobMatch, 201);
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
