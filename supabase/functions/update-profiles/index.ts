// Supabase Edge Function: update-profiles
// Daily rebuild of user_skills and candidate_profiles for every user with new
// activity in the last 24 hours. Calls the SECURITY DEFINER PL/pgSQL helpers
// public.recalculate_user_skill and public.recalculate_candidate_profile.
//
// Trigger:
//   - Manually: POST /functions/v1/update-profiles { user_id?: string }
//   - Scheduled: pg_cron daily at 03:00 UTC (see migrations/012_cron_jobs.sql)
//
// Local dev:  npx supabase functions serve update-profiles --no-verify-jwt
// Deploy:     npx supabase functions deploy update-profiles

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UpdateRequest {
  user_id?: string;
  dry_run?: boolean;
  batch_size?: number;
}

interface UserSkillRow {
  skill_id: string;
  hours_logged: number;
  skill_proof_score: number;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as UpdateRequest;
    const { user_id, dry_run = false, batch_size = 50 } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Determine user set
    let userIds: string[] = [];
    if (user_id) {
      userIds = [user_id];
    } else {
      // Users with sessions OR github_activity in the last 24h
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: activeSessionUsers, error: e1 } = await supabaseAdmin
        .from("sessions")
        .select("user_id")
        .gte("started_at", sinceIso)
        .limit(1000);
      if (e1) return jsonResponse({ error: e1.message }, 500);

      const { data: activeCommitUsers, error: e2 } = await supabaseAdmin
        .from("github_activity")
        .select("user_id")
        .gte("committed_at", sinceIso)
        .limit(1000);
      if (e2) return jsonResponse({ error: e2.message }, 500);

      const set = new Set<string>();
      for (const r of activeSessionUsers ?? []) set.add(r.user_id);
      for (const r of activeCommitUsers ?? []) set.add(r.user_id);
      userIds = Array.from(set);
    }

    if (userIds.length === 0) {
      return jsonResponse({ updated: 0, message: "No users with recent activity" });
    }

    // 2. For each user: refresh the top-N skills that actually have data
    let profilesUpdated = 0;
    let skillsUpdated = 0;
    const errors: Array<{ user_id: string; message: string }> = [];

    for (const uid of userIds) {
      try {
        // Top skill_ids derived from recent sessions (project_name) + repos
        // We reuse the SQL function ensure_user_skill_row for safety on each.
        const { data: skills, error: sErr } = await supabaseAdmin
          .rpc("rebuild_user_skills", { p_user_id: uid });
        if (sErr) throw new Error(sErr.message);
        const skillRows = (skills as UserSkillRow[] | null) ?? [];
        skillsUpdated += skillRows.length;

        if (dry_run) continue;

        // Re-aggregate the candidate profile from the freshly-updated skills
        const { error: pErr } = await supabaseAdmin
          .rpc("recalculate_candidate_profile", { p_user_id: uid });
        if (pErr) throw new Error(pErr.message);
        profilesUpdated += 1;
      } catch (perUserErr) {
        errors.push({
          user_id: uid,
          message: perUserErr instanceof Error ? perUserErr.message : String(perUserErr),
        });
      }
    }

    return jsonResponse({
      users_considered: userIds.length,
      skills_updated: skillsUpdated,
      profiles_updated: profilesUpdated,
      dry_run,
      errors: errors.length ? errors.slice(0, 10) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
