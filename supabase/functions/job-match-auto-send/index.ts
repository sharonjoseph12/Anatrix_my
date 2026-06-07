// supabase/functions/job-match-auto-send/index.ts
// T081 helper — college-side "Auto-Send": for each named opted-in student on
// the match list, fire a recruiter-invite on the company's behalf using a
// stored template.

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

  const { company_id, student_ids = [], role_title, message } = await req.json() as { company_id?: string; student_ids?: string[]; role_title?: string; message?: string };
  if (!company_id || student_ids.length === 0) return json({ error: "company_id and student_ids required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  let sent = 0;
  for (const studentId of student_ids) {
    const { data: jm, error } = await admin.from("job_matches").insert({
      student_user_id: studentId,
      recruiter_user_id: user.id,
      company_id,
      role_title: role_title ?? null,
      message: message ?? null,
      status: "reached_out",
      source: "college_auto_send",
    }).select("id").single();
    if (!error && jm) {
      await admin.from("nudges").insert({
        user_id: studentId,
        type: "verification",
        channel: "whatsapp",
        template_id: "JOB_MATCH_INVITE",
        trigger_source: "event_commit",
        delivery_status: "queued",
        personalization_context: { job_match_id: jm.id, role_title, message },
        rendered_body: "",
        send_after: new Date().toISOString(),
      });
      sent++;
    }
  }
  return json({ sent, total: student_ids.length });
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
