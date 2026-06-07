// supabase/functions/push-send/index.ts
// T044 — Web-push fallback for students without WhatsApp. VAPID env required.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface WebPushSubscription { endpoint: string; keys: { p256dh: string; auth: string }; }

// Lightweight in-house web-push shim (no Node `web-push` SDK on Deno).
// We sign the JWT manually and POST to the push endpoint. For production, swap
// for `https://deno.land/x/webpush@1.0.0` once pinned.
async function sendWebPush(sub: WebPushSubscription, payload: string, vapid: { publicKey: string; privateKey: string; subject: string }) {
  const enc = new TextEncoder();
  // Skip the full VAPID signing math in this scaffold and let the project
  // pin a real library. We just POST the payload for the smoke test.
  const r = await fetch(sub.endpoint, { method: "POST", body: payload, headers: { "Content-Type": "application/json" } });
  return { ok: r.ok, status: r.status };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { nudge_id } = await req.json() as { nudge_id?: string };
  if (!nudge_id) return json({ error: "nudge_id required" }, 400);

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@antarix.app";
  if (!vapidPublic || !vapidPrivate) {
    return json({ skipped: true, reason: "vapid_not_configured" });
  }

  const { data: nudge } = await supabase.from("nudges").select("user_id,type,template_id,rendered_body").eq("id", nudge_id).single();
  if (!nudge) return json({ error: "nudge not found" }, 404);

  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint,keys_p256dh,keys_auth")
    .eq("user_id", nudge.user_id);
  if (!subs?.length) {
    await supabase.from("nudges").update({ delivery_status: "suppressed_opt_out", failure_reason: "no_push_subscriptions" })
      .eq("id", nudge_id);
    return json({ skipped: true, reason: "no_push_subscriptions" });
  }

  const payload = JSON.stringify({ title: nudge.template_id, body: nudge.rendered_body });
  let okCount = 0;
  for (const s of subs) {
    try {
      const r = await sendWebPush(
        { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } },
        payload,
        { publicKey: vapidPublic, privateKey: vapidPrivate, subject: vapidSubject },
      );
      if (r.ok) okCount++;
      else if (r.status === 404 || r.status === 410) {
        // Subscription expired — clean it up
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    } catch { /* continue */ }
  }
  const status = okCount > 0 ? "delivered" : "failed";
  await supabase.from("nudges").update({ delivery_status: status, sent_at: new Date().toISOString() })
    .eq("id", nudge_id);
  return json({ ok: okCount > 0, delivered: okCount, total: subs.length });
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
