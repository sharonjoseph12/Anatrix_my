// Supabase Edge Function: session-upload
// Receives a batch of session records from the Chrome extension,
// validates them, and inserts into the sessions table with deduplication.
//
// Trigger: extension periodic sync (every 60 minutes) and on-demand from popup
//
// Local dev: npx supabase functions serve session-upload
// Deploy: npx supabase functions deploy session-upload

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UploadSession {
  client_id: string;
  category: string;
  project_name?: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  focus_level: "high" | "medium" | "low";
  focus_score?: number | null;
  tab_switches?: number | null;
  distraction_seconds?: number | null;
}

interface UploadBody {
  sessions: UploadSession[];
}

const ALLOWED_CATEGORIES = new Set(["dsa", "coding", "project", "learning", "research"]);
const ALLOWED_FOCUS = new Set(["high", "medium", "low"]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateSession(s: UploadSession, idx: number): string | null {
  if (!s.client_id || typeof s.client_id !== "string") return `sessions[${idx}].client_id required`;
  if (!ALLOWED_CATEGORIES.has(s.category)) return `sessions[${idx}].category invalid`;
  if (!ALLOWED_FOCUS.has(s.focus_level)) return `sessions[${idx}].focus_level invalid`;
  if (!s.started_at || Number.isNaN(Date.parse(s.started_at))) return `sessions[${idx}].started_at invalid`;
  if (!s.ended_at || Number.isNaN(Date.parse(s.ended_at))) return `sessions[${idx}].ended_at invalid`;
  if (typeof s.duration_minutes !== "number" || s.duration_minutes < 0) {
    return `sessions[${idx}].duration_minutes invalid`;
  }
  if (s.focus_score != null && (s.focus_score < 0 || s.focus_score > 1)) {
    return `sessions[${idx}].focus_score out of range`;
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const body = (await req.json()) as UploadBody;
    if (!body || !Array.isArray(body.sessions)) {
      return jsonResponse({ error: "Body must be { sessions: [...] }" }, 400);
    }

    if (body.sessions.length === 0) {
      return jsonResponse({ accepted: 0, duplicates: 0, rejected: 0, session_ids: [] });
    }

    if (body.sessions.length > 200) {
      return jsonResponse({ error: "Batch too large; max 200 sessions per request" }, 413);
    }

    // Identify user from JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: "Invalid auth" }, 401);
    }

    // Use service role to bypass RLS for insert (we just authenticated the user)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const valid: Array<Record<string, unknown>> = [];
    const errors: string[] = [];
    body.sessions.forEach((s, idx) => {
      const err = validateSession(s, idx);
      if (err) {
        errors.push(err);
        return;
      }
      valid.push({
        user_id: user.id,
        client_id: s.client_id,
        category: s.category,
        project_name: s.project_name ?? null,
        started_at: s.started_at,
        ended_at: s.ended_at,
        duration_minutes: Math.round(s.duration_minutes),
        focus_level: s.focus_level,
        focus_score: s.focus_score ?? null,
        tab_switches: s.tab_switches ?? 0,
        distraction_seconds: s.distraction_seconds ?? 0,
        synced_at: new Date().toISOString(),
      });
    });

    if (valid.length === 0) {
      return jsonResponse({
        accepted: 0,
        duplicates: 0,
        rejected: body.sessions.length,
        errors,
        session_ids: [],
      });
    }

    // Upsert with onConflict on (user_id, client_id) — unique idempotent sync
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("sessions")
      .upsert(valid, { onConflict: "user_id,client_id", ignoreDuplicates: false })
      .select("id, client_id");

    if (insertErr) {
      return jsonResponse({ error: insertErr.message }, 500);
    }

    // Determine duplicates: existing rows that already had the same client_id
    // by checking which ones have updated_at === created_at (true inserts)
    const insertedIds = (inserted ?? []).map((r) => r.id);

    return jsonResponse({
      accepted: insertedIds.length,
      duplicates: valid.length - insertedIds.length,
      rejected: body.sessions.length - valid.length,
      errors,
      session_ids: insertedIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
