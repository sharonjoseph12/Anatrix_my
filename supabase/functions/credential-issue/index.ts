// supabase/functions/credential-issue/index.ts
// T065 — Create or refresh a verifiable_credentials snapshot. Refreshes only
// when abs(current_score - snapshot_overall_score) >= CREDENTIAL_SNAPSHOT_REFRESH_DELTA.
// A-014 default delta is 3.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DELTA_DEFAULT = 3;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const delta = Number(Deno.env.get("CREDENTIAL_SNAPSHOT_REFRESH_DELTA") ?? DELTA_DEFAULT);
  const url = new URL(req.url);
  const singleUserId = url.searchParams.get("user_id");

  const userIds = singleUserId
    ? [singleUserId]
    : (await supabase.from("candidate_profiles").select("user_id,skill_proof_score")).data?.map((r) => r.user_id) ?? [];

  let issued = 0;
  let refreshed = 0;
  let skipped = 0;

  for (const userId of userIds) {
    const { data: cp } = await supabase.from("candidate_profiles").select("skill_proof_score,per_skill_scores,verified_activity,cohort_percentile")
      .eq("user_id", userId).maybeSingle();
    if (!cp) { skipped++; continue; }

    const { data: existing } = await supabase.from("verifiable_credentials")
      .select("id,public_slug,snapshot_overall_score,revocation_status")
      .eq("user_id", userId).eq("revocation_status", "active")
      .order("snapshot_taken_at", { ascending: false }).limit(1).maybeSingle();

    const needsRefresh = !existing || Math.abs((cp.skill_proof_score ?? 0) - existing.snapshot_overall_score) >= delta;
    if (!needsRefresh) { skipped++; continue; }

    const publicSlug = existing?.public_slug ?? `${slugify(userId)}-${randomSlug()}`;
    const row = {
      user_id: userId,
      public_slug: publicSlug,
      snapshot_overall_score: cp.skill_proof_score ?? 0,
      snapshot_per_skill: cp.per_skill_scores ?? {},
      snapshot_activity_totals: cp.verified_activity ?? {},
      snapshot_cohort_percentile: cp.cohort_percentile ?? null,
      snapshot_taken_at: new Date().toISOString(),
      revocation_status: "active",
    };
    let credId: string | null = existing?.id ?? null;
    if (existing) {
      await supabase.from("verifiable_credentials").update(row).eq("id", existing.id);
      refreshed++;
    } else {
      const { data: ins } = await supabase.from("verifiable_credentials").insert(row).select("id").single();
      credId = ins?.id ?? null;
      issued++;
    }
    await supabase.from("users").update({ verifiable_credential_id: credId }).eq("id", userId);
  }

  return json({ users: userIds.length, issued, refreshed, skipped, delta });
});

function slugify(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
}
function randomSlug(): string {
  return Math.random().toString(36).slice(2, 8);
}

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
