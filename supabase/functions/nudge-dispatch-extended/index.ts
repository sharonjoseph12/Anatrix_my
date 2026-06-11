// supabase/functions/nudge-dispatch-extended/index.ts
// T043 — Channel-aware nudge dispatcher. For each pending nudge (kind ∈
//   {daily_morning, real_time_peak, streak_risk, weekly_summary, interview_scheduled,
//   hiring_outcome, company_interest, insight_ready, cohort_invite}):
//   1. Load the user's nudge_preferences + external_channel_handles.
//   2. Call pickChannel() (inlined, see channel-resolver.ts) to choose
//      {in_app, telegram, discord, whatsapp} or null (suppressed).
//   3. Dispatch:
//        - in_app   → insert into notifications (consumed by NotificationHost)
//        - telegram → POST https://api.telegram.org/bot<token>/sendMessage
//        - discord  → POST https://discord.com/api/v10/channels/<id>/messages
//        - whatsapp → POST existing wa-business endpoint (no-op if not configured)
//
// Invoked by cron `nudge-dispatch-30m` every 30 min; also by manual trigger
// for testing.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WA_SEND_URL = Deno.env.get("WHATSAPP_SEND_URL") ?? "";
const WA_SEND_TOKEN = Deno.env.get("WHATSAPP_SEND_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Channel = "in_app" | "telegram" | "discord" | "whatsapp";

type Prefs = {
  whatsapp_premium_opt_in?: boolean;
  whatsapp_handle?: string | null;
  whatsapp_verified?: boolean;
  telegram_handle?: string | null;
  telegram_verified?: boolean;
  discord_handle?: string | null;
  discord_verified?: boolean;
  channel_priority?: Channel;
  pause_all?: boolean;
  quiet_start_local?: string;
  quiet_end_local?: string;
};

type PendingNudge = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  payload: Record<string, unknown> | null;
};

function pickChannel(p: Prefs, quiet: boolean, exam: boolean): Channel | null {
  if (p.pause_all || quiet || exam) return null;
  if (p.whatsapp_premium_opt_in && p.whatsapp_verified && p.whatsapp_handle) return "whatsapp";
  if (p.telegram_verified && p.telegram_handle) return "telegram";
  if (p.discord_verified && p.discord_handle) return "discord";
  return "in_app";
}

function isQuietNow(prefs: Prefs, now: Date): boolean {
  if (!prefs.quiet_start_local || !prefs.quiet_end_local) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMin(prefs.quiet_start_local);
  const end = toMin(prefs.quiet_end_local);
  if (start <= end) return minutes >= start && minutes < end;
  // Wraps midnight: e.g. 22:00 → 07:00
  return minutes >= start || minutes < end;
}

async function dispatch(
  nudge: PendingNudge,
  channel: Channel,
  handle: { platform_id: string; dm_channel_id: string | null } | null,
): Promise<"sent" | "failed"> {
  const text = `${nudge.title}\n${nudge.body ?? ""}${nudge.href ? `\n${nudge.href}` : ""}`;

  if (channel === "in_app") {
    const { error } = await supabase.from("notifications").insert({
      user_id: nudge.user_id,
      kind: nudge.kind,
      title: nudge.title,
      body: nudge.body,
      href: nudge.href,
    });
    return error ? "failed" : "sent";
  }
  if (channel === "telegram") {
    if (!TELEGRAM_BOT_TOKEN || !handle) return "failed";
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: handle.platform_id, text }),
    });
    return r.ok ? "sent" : "failed";
  }
  if (channel === "discord") {
    if (!DISCORD_BOT_TOKEN || !handle?.dm_channel_id) return "failed";
    const r = await fetch(`https://discord.com/api/v10/channels/${handle.dm_channel_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: text }),
    });
    return r.ok ? "sent" : "failed";
  }
  if (channel === "whatsapp") {
    if (!WA_SEND_URL || !handle) return "failed";
    const r = await fetch(WA_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_SEND_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: handle.platform_id, text }),
    });
    return r.ok ? "sent" : "failed";
  }
  return "failed";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;

  // Pending nudges live in `notifications` with a `dispatched_at IS NULL` flag
  // added by the AI Coach pipeline (created in this migration; if column
  // missing, the query just no-ops).
  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id,user_id,kind,title,body,href")
    .is("dispatched_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  const list = (pending ?? []) as PendingNudge[];
  if (list.length === 0) {
    return new Response(JSON.stringify({ dispatched: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const now = new Date();
  let sent = 0;
  let failed = 0;
  let suppressed = 0;

  for (const n of list) {
    const [prefsRes, handleRes, examRes] = await Promise.all([
      supabase.from("nudge_preferences").select("*").eq("user_id", n.user_id).maybeSingle(),
      supabase
        .from("external_channel_handles")
        .select("channel,platform_id,dm_channel_id,verified")
        .eq("user_id", n.user_id)
        .eq("verified", true),
      supabase
        .from("exams")
        .select("id")
        .eq("user_id", n.user_id)
        .lte("starts_at", now.toISOString())
        .gte("ends_at", now.toISOString())
        .limit(1),
    ]);
    const prefs = (prefsRes.data ?? {}) as Prefs;
    const handles = (handleRes.data ?? []) as Array<{
      channel: Channel;
      platform_id: string;
      dm_channel_id: string | null;
      verified: boolean;
    }>;
    const exam = !!(examRes.data && (examRes.data as unknown[]).length > 0);
    const quiet = isQuietNow(prefs, now);

    const channel = pickChannel(prefs, quiet, exam);
    if (!channel) {
      suppressed++;
      await supabase.from("notifications").update({ dispatched_at: now.toISOString() }).eq("id", n.id);
      continue;
    }

    let handle: { platform_id: string; dm_channel_id: string | null } | null = null;
    if (channel !== "in_app") {
      const found = handles.find((h) => h.channel === channel);
      handle = found ? { platform_id: found.platform_id, dm_channel_id: found.dm_channel_id } : null;
    }

    const result = await dispatch(n, channel, handle);
    if (result === "sent") sent++; else failed++;
    await supabase
      .from("notifications")
      .update({
        dispatched_at: now.toISOString(),
        dispatched_channel: channel,
        dispatched_status: result,
      })
      .eq("id", n.id);
  }

  return new Response(
    JSON.stringify({ processed: list.length, sent, failed, suppressed }),
    { headers: { "Content-Type": "application/json" } },
  );
});
