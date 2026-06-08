// supabase/functions/whatsapp-send/index.ts
// T043 — Given a queued nudge, send it via the configured provider and update
// delivery_status. Depends on T011 (Meta template registration) being complete
// before live traffic; until then the function logs to nudges and short-circuits.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTemplate } from "../_shared/whatsapp-provider.ts";

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

  const { data: nudge } = await supabase.from("nudges").select("user_id,type,template_id,personalization_context")
    .eq("id", nudge_id).single();
  if (!nudge) return json({ error: "nudge not found" }, 404);

  const { data: wa } = await supabase.from("whatsapp_connections")
    .select("phone_number,status").eq("user_id", nudge.user_id).eq("status", "active").maybeSingle();
  if (!wa) {
    await supabase.from("nudges").update({ delivery_status: "suppressed_opt_out", failure_reason: "no_active_whatsapp" })
      .eq("id", nudge_id);
    return json({ skipped: true, reason: "no_active_whatsapp" });
  }

  // T011 BLOCKER: this requires WHATSAPP_META_TEMPLATE_* ids registered in Meta
  // Business Manager. If unset, we short-circuit and log.
  const metaTemplateName = Deno.env.get(`WHATSAPP_META_TEMPLATE_${nudge.type.toUpperCase()}`);
  if (!metaTemplateName) {
    await supabase.from("nudges").update({ delivery_status: "failed", failure_reason: "t011_template_not_registered" })
      .eq("id", nudge_id);
    return json({
      skipped: true,
      reason: "t011_template_not_registered",
      hint: "Register template in Meta Business Manager and set WHATSAPP_META_TEMPLATE_<TYPE> env var",
    });
  }

  try {
    const result = await sendTemplate({
      to: wa.phone_number,
      templateName: metaTemplateName,
      languageCode: Deno.env.get("WHATSAPP_DEFAULT_LANGUAGE") ?? "en",
      parameters: [
        (nudge.personalization_context as Record<string, unknown>)?.name as string ?? "there",
        String((nudge.personalization_context as Record<string, unknown>)?.score ?? ""),
      ],
    });
    const status = result.ok ? "delivered" : "failed";
    await supabase.from("nudges").update({
      delivery_status: status,
      failure_reason: result.error ?? null,
      sent_at: new Date().toISOString(),
    }).eq("id", nudge_id);
    await supabase.from("whatsapp_connections").update({
      last_delivery_at: result.ok ? new Date().toISOString() : undefined,
      last_error: result.ok ? null : result.error,
    }).eq("user_id", nudge.user_id);
    return json({ ok: result.ok, status, provider_message_id: result.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("nudges").update({ delivery_status: "failed", failure_reason: message })
      .eq("id", nudge_id);
    return json({ ok: false, error: message }, 500);
  }
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
