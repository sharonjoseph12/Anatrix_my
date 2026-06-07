// apps/web/src/app/api/channels/verify/route.ts
// T039 — POST { channel } → sends a hello to the user's connected handle to
// confirm the channel works end-to-end. Marks `verified = true` on success.

import { NextResponse } from "next/server";
import { channelVerifySchema } from "@/lib/validation/schemas";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const DISCORD_API = "https://discord.com/api/v10";
const TELEGRAM_API = "https://api.telegram.org/bot";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `channels-verify:${user.id}`, limit: 5, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = channelVerifySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { channel } = parsed.data;

  const admin = createSupabaseServiceClient();
  const { data: handle } = await admin
    .from("external_channel_handles")
    .select("*")
    .eq("user_id", user.id)
    .eq("channel", channel)
    .eq("verified", true)
    .maybeSingle();
  if (!handle) {
    return NextResponse.json({ error: `No verified ${channel} connection found` }, { status: 404 });
  }
  const h = handle as {
    platform_id: string;
    dm_channel_id: string | null;
  };

  const hello =
    channel === "discord"
      ? "Hey! 👋 This is a test message from Antarix. Your Discord channel is connected and you'll receive nudges here."
      : "Hey! 👋 This is a test message from Antarix. Your Telegram channel is connected and you'll receive nudges here.";

  let delivery: "ok" | "failed" = "failed";
  if (channel === "discord") {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (botToken && h.dm_channel_id) {
      const r = await fetch(`${DISCORD_API}/channels/${h.dm_channel_id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: hello }),
      });
      delivery = r.ok ? "ok" : "failed";
    }
  } else if (channel === "telegram") {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      const r = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: h.platform_id,
          text: hello,
        }),
      });
      delivery = r.ok ? "ok" : "failed";
    }
  } else {
    return NextResponse.json({ error: "WhatsApp verification is not supported via this endpoint" }, { status: 400 });
  }

  if (delivery !== "ok") {
    await admin
      .from("external_channel_handles")
      .update({ verified: false, disconnected_reason: "delivery_failed" })
      .eq("user_id", user.id)
      .eq("channel", channel);
    return NextResponse.json(
      { ok: false, error: "Failed to deliver test message. Try reconnecting." },
      { status: 502 },
    );
  }

  await admin
    .from("external_channel_handles")
    .update({ last_verified_at: new Date().toISOString(), disconnected_reason: null })
    .eq("user_id", user.id)
    .eq("channel", channel);

  return NextResponse.json({ ok: true, delivery: "ok" });
}
