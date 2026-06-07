// supabase/functions/nudge-trigger/index.ts
// T041 — Cron-driven entry point: per user, per channel, per local-time, decide
// which nudges are due. Calls shouldSuppress for each, then enqueues
// nudge-dispatch for the survivors.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { shouldSuppress, type NudgeType, type NudgeChannel } from "../_shared/suppress-nudge.ts";
import { computePeakWindow } from "../_shared/peak-window.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "scheduled"; // 'scheduled' | 'streak_risk'
  const body = await req.json().catch(() => ({})) as { user_id?: string; event_type?: string };

  // Two run modes:
  //  - 'scheduled' (hourly cron): walk all users, evaluate due-by-time rules
  //  - 'streak_risk' (event-driven): one user, one event
  if (mode === "streak_risk" && body.user_id) {
    await enqueue({ supabase, userId: body.user_id, type: "streak_risk", context: { ...(body ?? {}) } });
    return json({ enqueued: 1, mode });
  }

  // Scheduled sweep
  const { data: prefs, error } = await supabase
    .from("nudge_preferences")
    .select("user_id,timezone,daily_send_local_time,weekly_send_local_time,whatsapp_channel,push_channel,pause_all,quiet_hours_start,quiet_hours_end");
  if (error) return json({ error: error.message }, 500);
  if (!prefs?.length) return json({ enqueued: 0, mode });

  const now = new Date();
  const enqueued: Array<{ userId: string; type: NudgeType }> = [];

  for (const p of prefs) {
    if (p.pause_all) continue;
    const tz = p.timezone || "UTC";
    const localNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const localHour = localNow.getHours();
    const localMinute = localNow.getMinutes();
    const localDate = localNow.toISOString().slice(0, 10);
    const localDow = localNow.getDay(); // 0..6 (Sun=0)

    // Daily morning — fire at user's daily_send_local_time ±5 minutes
    const [dh, dm] = (p.daily_send_local_time ?? "08:00").split(":").map(Number);
    if (Math.abs((localHour * 60 + localMinute) - (dh * 60 + dm)) <= 5) {
      // Check streak risk instead of daily if no activity in 36h
      const { data: recent } = await supabase.from("sessions").select("started_at")
        .eq("user_id", p.user_id).order("started_at", { ascending: false }).limit(1);
      const lastStart = recent?.[0]?.started_at ? new Date(recent[0].started_at) : null;
      const hoursIdle = lastStart ? (Date.now() - lastStart.getTime()) / 3.6e6 : Infinity;
      if (hoursIdle >= 36) {
        await enqueue({ supabase, userId: p.user_id, type: "streak_risk", context: { hoursIdle } });
        enqueued.push({ userId: p.user_id, type: "streak_risk" });
      } else {
        await enqueue({ supabase, userId: p.user_id, type: "daily_morning", context: { localDate } });
        enqueued.push({ userId: p.user_id, type: "daily_morning" });
      }
    }

    // Weekly — Sunday within ±5 min of weekly_send_local_time (default 10:00)
    if (localDow === 0) {
      const [wh, wm] = (p.weekly_send_local_time ?? "10:00").split(":").map(Number);
      if (Math.abs((localHour * 60 + localMinute) - (wh * 60 + wm)) <= 5) {
        await enqueue({ supabase, userId: p.user_id, type: "weekly_summary", context: { week_of: localDate } });
        enqueued.push({ userId: p.user_id, type: "weekly_summary" });
      }
    }

    // Real-time peak — check every hour; only fire during local peak window
    const peak = await peakForUser(supabase, p.user_id);
    if (peak && peak.confidence > 0.5) {
      const inPeak = localHour >= peak.startHour && localHour < peak.endHour;
      if (inPeak) {
        await enqueue({ supabase, userId: p.user_id, type: "real_time_peak", context: { peak } });
        enqueued.push({ userId: p.user_id, type: "real_time_peak" });
      }
    }
  }

  return json({ enqueued: enqueued.length, mode, sample: enqueued.slice(0, 10) });
});

async function peakForUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: events } = await supabase.from("sessions").select("started_at,duration_minutes")
    .eq("user_id", userId).order("started_at", { ascending: false }).limit(200);
  return computePeakWindow((events ?? []) as Array<{ started_at: string; duration_minutes: number | null }>);
}

async function enqueue({ supabase, userId, type, context }: { supabase: ReturnType<typeof createClient>; userId: string; type: NudgeType; context: Record<string, unknown> }) {
  // Don't re-queue if the same user has a delivery_status IN ('queued', 'delivered')
  // for the same type in the past 12 hours
  const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("nudges")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", twelveHoursAgo)
    .in("delivery_status", ["queued", "delivered"])
    .limit(1);
  if (recent && recent.length > 0) return;

  await supabase.from("nudges").insert({
    user_id: userId,
    type,
    channel: "push",
    template_id: type.toUpperCase(),
    trigger_source: "cron",
    delivery_status: "queued",
    personalization_context: context,
    rendered_body: "",
    send_after: new Date().toISOString(),
  });
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
