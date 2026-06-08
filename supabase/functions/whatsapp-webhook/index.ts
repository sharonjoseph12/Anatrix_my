// supabase/functions/whatsapp-webhook/index.ts
// T045 — Inbound handler. Verifies webhook token, resolves phone → user, applies
// the documented command set, dispatches a confirmation reply.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyWebhookMeta } from "../_shared/whatsapp-provider.ts";

const COMMANDS = ["START", "DONE", "STATS", "RANK", "HELP", "PAUSE", "RESUME", "JOIN", "LEAVE", "WHY"] as const;
const NUDGE_COMMANDS = ["START", "DONE", "STATS", "RANK", "HELP", "PAUSE", "RESUME"] as const;
type Command = typeof COMMANDS[number];
type NudgeCommand = typeof NUDGE_COMMANDS[number];

serve(async (req: Request) => {
  if (req.method === "GET") return ping(req);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const provider = Deno.env.get("WHATSAPP_PROVIDER") ?? "meta";
  const raw = await req.text();
  const ok = provider === "meta" ? await verifyWebhookMeta(raw, req.headers) : raw.length > 0;
  if (!ok) return json({ error: "invalid_signature" }, 401);

  const payload = JSON.parse(raw) as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from: string; text?: { body: string } }> } }> }> };
  const messages = payload?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
  for (const m of messages) {
    const text = (m.text?.body ?? "").trim();
    const cmd = text.toUpperCase().split(/\s+/)[0] as Command;
    if (!COMMANDS.includes(cmd)) continue;
    const { data: wa } = await supabase.from("whatsapp_connections").select("user_id")
      .eq("phone_number", m.from).maybeSingle();
    if (!wa?.user_id) continue;

    if (NUDGE_COMMANDS.includes(cmd as NudgeCommand)) {
      await supabase.from("nudge_responses").insert({
        nudge_id: await latestNudgeId(supabase, wa.user_id),
        user_id: wa.user_id,
        channel: "whatsapp",
        response_kind: "command",
        command: cmd as NudgeCommand,
        raw_text: text,
      });
    } else if (cmd === "WHY") {
      await supabase.from("nudge_responses").insert({
        nudge_id: await latestNudgeId(supabase, wa.user_id),
        user_id: wa.user_id,
        channel: "whatsapp",
        response_kind: "reply_text",
        raw_text: text,
      });
    }
    await applyCommand(supabase, wa.user_id, cmd, text);
  }
  return json({ ok: true });
});

async function latestNudgeId(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data } = await supabase.from("nudges").select("id")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
  if (data?.[0]?.id) return data[0].id;
  const stub = await supabase.from("nudges").insert({
    user_id: userId,
    type: "verification",
    channel: "whatsapp",
    template_id: "WEBHOOK_STUB",
    trigger_source: "student_reply",
    delivery_status: "delivered",
    personalization_context: { purpose: "webhook_stub" },
    rendered_body: "",
    send_after: new Date().toISOString(),
    sent_at: new Date().toISOString(),
  }).select("id").single();
  return stub.data?.id ?? "00000000-0000-0000-0000-000000000000";
}

async function applyCommand(supabase: ReturnType<typeof createClient>, userId: string, cmd: Command, _raw: string) {
  if (cmd === "PAUSE") {
    await supabase.from("nudge_preferences").update({ pause_all: true }).eq("user_id", userId);
  } else if (cmd === "RESUME") {
    await supabase.from("nudge_preferences").update({ pause_all: false }).eq("user_id", userId);
  } else if (cmd === "JOIN") {
    const cohortId = _raw.split(/\s+/)[1];
    if (cohortId) await supabase.from("cohort_members").upsert({ user_id: userId, cohort_id: cohortId });
  } else if (cmd === "LEAVE") {
    const cohortId = _raw.split(/\s+/)[1];
    if (cohortId) await supabase.from("cohort_members").delete().eq("user_id", userId).eq("cohort_id", cohortId);
  } else if (cmd === "START" || cmd === "DONE") {
    if (cmd === "START") {
      await supabase.from("sessions").insert({
        user_id: userId, category: "ad-hoc", started_at: new Date().toISOString(),
        is_ad_hoc: true, source: "whatsapp_command",
      });
    } else {
      const { data: open } = await supabase.from("sessions").select("id")
        .eq("user_id", userId).is("ended_at", null).order("started_at", { ascending: false }).limit(1);
      if (open?.[0]) {
        await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", open[0].id);
      }
    }
  } else if (cmd === "STATS" || cmd === "RANK" || cmd === "HELP" || cmd === "WHY") {
    // Reply rendered by a separate outbox dispatcher; nudge type `verification`
    // is the closest existing enum value for an info-reply. The `command` lives
    // in personalization_context.
    await supabase.from("nudges").insert({
      user_id: userId,
      type: "verification",
      channel: "whatsapp",
      template_id: `REPLY_${cmd}`,
      trigger_source: "student_reply",
      delivery_status: "queued",
      personalization_context: { command: cmd, raw: _raw },
      rendered_body: "",
      send_after: new Date().toISOString(),
    });
  }
}

function ping(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && challenge) return new Response(challenge, { status: 200 });
  return new Response("ok");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cor(), "Content-Type": "application/json" } });
}
function cor() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}
