// supabase/functions/nudge-dispatch/index.ts
// T042 — Pick a template, render it, hand off to whatsapp-send or push-send.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { renderTemplate } from "../_shared/template-render.ts";
import { shouldSuppress, type NudgeChannel, type NudgeType } from "../_shared/suppress-nudge.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const body = await req.json() as { user_id?: string; event_type?: string; context?: Record<string, unknown> };
  if (!body.user_id) return json({ error: "user_id required" }, 400);

  const userId = body.user_id;
  const type = (body.event_type as NudgeType) ?? "daily_morning";
  const context = body.context ?? {};

  // Load prefs
  const { data: prefs } = await supabase.from("nudge_preferences").select("*").eq("user_id", userId).single();
  if (!prefs) return json({ error: "no preferences" }, 404);
  if (prefs.pause_all) return json({ skipped: true, reason: "pause_all" });

  // Determine which channel wins: WhatsApp first if opted in + connection active, else push
  const channel: NudgeChannel = prefs.whatsapp_channel ? "whatsapp" : "push";
  const { data: examWindows } = await supabase.from("exam_windows").select("start_date,end_date")
    .eq("user_id", userId).gte("end_date", new Date().toISOString().slice(0, 10));
  const suppression = shouldSuppress({
    prefs: prefs as Record<string, unknown>,
    type,
    channel,
    localNow: new Date(),
    localDate: new Date().toISOString().slice(0, 10),
    examWindows: examWindows ?? [],
  });
  if (suppression) return json({ skipped: true, reason: suppression });

  // T097 — WhatsApp cost guard
  if (channel === "whatsapp") {
    const weekly = await weeklyCount(supabase, userId);
    const cap = Number(Deno.env.get("WHATSAPP_COST_GUARD_WEEKLY_MESSAGES_PER_STUDENT") ?? 20);
    if (weekly >= cap) {
      // Fall back to push-only and emit metric
      await supabase.from("whatsapp_connections")
        .update({ last_error: "cost_guard_weekly_cap_hit" })
        .eq("user_id", userId);
      return enqueuePush({ supabase, userId, type, context, prefs, body: { reason: "whatsapp_cap" } });
    }
  }

  // Load student context (display name, peak hours, score)
  const { data: profile } = await supabase.from("users").select("display_name, full_name").eq("id", userId).single();
  const { data: cp } = await supabase.from("candidate_profiles").select("skill_proof_score,peak_window_start_local_hour,peak_window_end_local_hour,current_streak_days")
    .eq("user_id", userId).maybeSingle();
  const templateCtx = {
    name: profile?.display_name ?? profile?.full_name?.split(" ")[0] ?? "there",
    score: cp?.skill_proof_score ?? 0,
    streak: cp?.current_streak_days ?? 0,
    peak_start: cp?.peak_window_start_local_hour ?? 9,
    peak_end: cp?.peak_window_end_local_hour ?? 12,
    ...context,
  };

  const { templateId, body: renderedBody } = renderTemplate(type, templateCtx);

  // Insert nudge row + dispatch
  const { data: nudge, error: insertErr } = await supabase.from("nudges").insert({
    user_id: userId,
    type,
    channel,
    template_id: templateId,
    trigger_source: body.event_type ? "event_commit" : "cron",
    delivery_status: "queued",
    personalization_context: templateCtx,
    rendered_body: renderedBody,
    send_after: new Date().toISOString(),
  }).select("id").single();
  if (insertErr || !nudge) return json({ error: insertErr?.message ?? "insert failed" }, 500);

  const target = channel === "whatsapp" ? "whatsapp-send" : "push-send";
  await supabase.functions.invoke(target, { body: { nudge_id: nudge.id } });
  return json({ nudge_id: nudge.id, channel });
});

async function weeklyCount(supabase: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from("nudges").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("delivery_status", "delivered").gte("created_at", since)
    .in("type", ["daily_morning", "real_time_peak", "streak_risk", "weekly_summary"]);
  return count ?? 0;
}

async function enqueuePush({ supabase, userId, type, context, prefs, body: extraBody }: { supabase: ReturnType<typeof createClient>; userId: string; type: NudgeType; context: Record<string, unknown>; prefs: Record<string, unknown>; body: { reason: string } }) {
  if (!prefs.push_channel) return json({ skipped: true, reason: "no_push_consent" });
  const { data: nudge } = await supabase.from("nudges").insert({
    user_id: userId,
    type,
    channel: "push",
    template_id: type.toUpperCase(),
    trigger_source: "cron",
    delivery_status: "queued",
    personalization_context: { ...context, ...extraBody },
    rendered_body: "",
    send_after: new Date().toISOString(),
  }).select("id").single();
  if (nudge) await supabase.functions.invoke("push-send", { body: { nudge_id: nudge.id } });
  return json({ nudge_id: nudge?.id, channel: "push_fallback" });
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
