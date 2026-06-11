// apps/web/src/app/api/channels/discord/callback/route.ts
// T038 — Discord OAuth2 callback. Exchanges `code` for a token, fetches the
// user, opens a DM channel via the bot, persists everything in
// `external_channel_handles` and marks it verified.
//
// Public (no user session) because Discord is the user-agent here. Auth is
// proven by the HMAC-signed `state` token issued by /api/channels/connect.

import { NextResponse } from "next/server";
import { verifyChannelToken } from "@/lib/channels/tokens";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const DISCORD_API = "https://discord.com/api/v10";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

type DiscordDmChannel = {
  id: string;
  type: number;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/settings/notifications?error=${encodeURIComponent(oauthError)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const verified = verifyChannelToken(state);
  if (!verified.ok || verified.token.pr !== "discord-oauth-state" || verified.token.ch !== "discord") {
    return NextResponse.json({ error: "Invalid or expired state" }, { status: 400 });
  }
  const userId = verified.token.uid;

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!clientId || !clientSecret || !redirectUri || !botToken) {
    return NextResponse.json({ error: "Discord is not configured" }, { status: 503 });
  }

  // 1) Exchange code for access_token
  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json(
      { error: "Discord token exchange failed", detail: text },
      { status: 502 },
    );
  }
  const tok = (await tokenRes.json()) as DiscordTokenResponse;

  // 2) Fetch user
  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!userRes.ok) {
    return NextResponse.json({ error: "Failed to fetch Discord user" }, { status: 502 });
  }
  const du = (await userRes.json()) as DiscordUser;

  // 3) Open a DM channel as the bot.
  //    DMs cannot be opened with a user_id; we must share a guild with the
  //    user. As a fallback we use the `users/@me/channels` endpoint which
  //    works for already-shared recipients. If it fails we mark
  //    `dm_channel_id = null` and surface a "Reconnect" CTA.
  let dmChannelId: string | null = null;
  try {
    const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: du.id }),
    });
    if (dmRes.ok) {
      const dm = (await dmRes.json()) as DiscordDmChannel;
      dmChannelId = dm.id;
    }
  } catch {
    dmChannelId = null;
  }

  // 4) Persist
  const admin = createSupabaseServiceClient();
  const upsertPayload: Record<string, unknown> = {
    user_id: userId,
    channel: "discord",
    platform_id: du.id,
    platform_handle: du.global_name ?? du.username,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? null,
    dm_channel_id: dmChannelId,
    verified: dmChannelId !== null,
    disconnected_reason: dmChannelId ? null : "dm_unavailable",
    last_verified_at: new Date().toISOString(),
  };
  const { error: upsertError } = await admin
    .from("external_channel_handles")
    .upsert(upsertPayload, { onConflict: "user_id,channel" });
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.redirect(
    new URL(`/settings/notifications?connected=discord${dmChannelId ? "" : "&warning=dm"}`, req.url),
  );
}
