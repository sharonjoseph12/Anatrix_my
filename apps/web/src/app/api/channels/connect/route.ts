// apps/web/src/app/api/channels/connect/route.ts
// T037 — POST { channel: "discord" | "telegram" } → returns either
//   { kind: "oauth", url } for Discord
//   { kind: "deep_link", url, token, expires_at } for Telegram
// The user then opens the URL to authorise (Discord) or the bot (Telegram).
//
// Auth: caller must be logged in. Rate-limited to 10/min per user.

import { NextResponse } from "next/server";
import { channelConnectSchema } from "@/lib/validation/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { signChannelToken } from "@/lib/channels/tokens";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `channels-connect:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = channelConnectSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { channel, return_path } = parsed.data;

  if (channel === "discord") {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return NextResponse.json({ error: "Discord OAuth is not configured" }, { status: 503 });
    }
    const state = signChannelToken({
      userId: user.id,
      channel: "discord",
      purpose: "discord-oauth-state",
    });
    const url = new URL("https://discord.com/api/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set(
      "response_type",
      "code",
    );
    url.searchParams.set("scope", "identify dm_channels.read bot");
    url.searchParams.set("permissions", "0");
    url.searchParams.set("state", state);
    url.searchParams.set(
      "prompt",
      "consent",
    );
    return NextResponse.json({ kind: "oauth", url: url.toString(), state });
  }

  if (channel === "telegram") {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
      return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 503 });
    }
    const token = signChannelToken({
      userId: user.id,
      channel: "telegram",
      purpose: "telegram-start",
    });
    const url = `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`;
    return NextResponse.json({
      kind: "deep_link",
      url,
      token,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      // For clients that want to render an in-page QR code as a fallback.
      bot_username: botUsername,
      return_path: return_path ?? "/settings/notifications",
    });
  }

  // WhatsApp goes through a different flow (premium opt-in) — punt.
  return NextResponse.json(
    { error: "WhatsApp requires a premium plan. Contact your administrator." },
    { status: 402 },
  );
}
