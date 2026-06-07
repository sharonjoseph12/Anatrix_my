// supabase/functions/credential-public/index.ts
// T066 — GET /functions/v1/credential-public/{slug}: public, no JWT. Bumps
// verification_count + last_verified_at. Returns HTML for browsers, JSON for
// API clients based on Accept.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const slug = new URL(req.url).pathname.split("/").pop();
  if (!slug) return json({ error: "slug required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const { data: cred } = await supabase.from("verifiable_credentials")
    .select("public_slug,user_id,snapshot_overall_score,snapshot_per_skill,snapshot_activity_totals,snapshot_cohort_percentile,snapshot_taken_at,revocation_status,verification_count,last_verified_at")
    .eq("public_slug", slug).maybeSingle();
  if (!cred) return json({ error: "not found" }, 404);

  // Bump counters via service role
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await admin.from("verifiable_credentials").update({
    verification_count: (cred.verification_count ?? 0) + 1,
    last_verified_at: new Date().toISOString(),
  }).eq("public_slug", slug);

  const { data: user } = await supabase.from("users").select("display_name,full_name,avatar_url").eq("id", cred.user_id).single();
  const { data: live } = await supabase.from("candidate_profiles").select("skill_proof_score").eq("user_id", cred.user_id).maybeSingle();
  const currentDelta = (live?.skill_proof_score ?? 0) - cred.snapshot_overall_score;

  const body = {
    student: {
      name: user?.display_name ?? user?.full_name ?? "Anonymous",
      avatar: user?.avatar_url ?? null,
    },
    overall_score: cred.snapshot_overall_score,
    per_skill: cred.snapshot_per_skill,
    verified_activity: cred.snapshot_activity_totals,
    cohort_percentile: cred.snapshot_cohort_percentile,
    snapshot_taken_at: cred.snapshot_taken_at,
    current_score_delta: currentDelta,
    revocation_status: cred.revocation_status,
    verification_count: (cred.verification_count ?? 0) + 1,
    last_verified_at: new Date().toISOString(),
  };

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) return html(body);
  return json(body, 200);
});

function html(b: ReturnType<typeof JSON.parse>) {
  const html = `<!doctype html><html lang="en"><head>
    <meta charset="utf-8" />
    <title>Antarix verified credential — ${b.student.name}</title>
    <meta property="og:title" content="Antarix verified credential" />
    <meta property="og:description" content="${b.student.name} · score ${b.overall_score} · verified ${b.verification_count} times" />
    <meta property="og:type" content="profile" />
    <style>body{font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#0a0a0a}
    .card{border:1px solid #e5e5e5;border-radius:12px;padding:24px}
    h1{font-size:20px;margin:0 0 8px}.pill{display:inline-block;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:12px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:14px}
    .row:last-child{border:0}.muted{color:#71717a;font-size:12px}</style></head>
    <body><div class="card">
    <h1>${b.student.name}</h1>
    <p class="muted">Antarix verified credential · <span class="pill">${b.revocation_status}</span></p>
    <div class="row"><span>Skill Proof Score</span><b>${b.overall_score}</b></div>
    <div class="row"><span>Cohort percentile</span><b>${b.cohort_percentile ?? "—"}</b></div>
    <div class="row"><span>Snapshot taken</span><b>${new Date(b.snapshot_taken_at).toLocaleDateString()}</b></div>
    <div class="row"><span>Current delta</span><b>${b.current_score_delta >= 0 ? "+" : ""}${b.current_score_delta}</b></div>
    <div class="row"><span>Verifications</span><b>${b.verification_count}</b></div>
    <p class="muted">Last verified ${new Date(b.last_verified_at).toLocaleString()}</p>
    </div></body></html>`;
  return new Response(html, { status: 200, headers: { ...cor(), "Content-Type": "text/html; charset=utf-8" } });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cor(), "Content-Type": "application/json" } });
}
function cor() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}
