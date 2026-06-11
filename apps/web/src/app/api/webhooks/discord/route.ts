// apps/web/src/app/api/webhooks/discord/route.ts
// T041 — Discord Interactions/Events webhook. Verifies X-Signature-Ed25519 per
// https://discord.com/developers/docs/interactions/Receiving-and-Responding
//
// We handle:
//   - PING (type 1) → return PONG (type 1)
//   - Slash command /stop → mark the Discord user as disconnected
//   - MESSAGE_CREATE `/start <token>` → bind user (rare without message-intent)

import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verify as verifyDiscordRequest, PlatformAlgorithm } from "discord-verify";
import { InteractionType, InteractionResponseType } from "discord-api-types/v10";
import { verifyChannelToken } from "@/lib/channels/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscordInteraction = {
  id: string;
  application_id: string;
  type: number;
  data?: { name?: string; options?: Array<{ name: string; value: string }> };
  user?: { id: string; username: string };
  member?: { user?: { id: string; username: string } };
  channel_id?: string;
  message?: { content?: string; author?: { id?: string } };
};

export async function POST(req: Request) {
  const publicKey = process.env.DISCORD_BOT_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "Discord webhook is not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-Signature-Ed25519");
  const timestamp = req.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return NextResponse.json({ error: "SubtleCrypto unavailable" }, { status: 500 });
  }

  let valid = false;
  try {
    valid = await verifyDiscordRequest(
      rawBody,
      signature,
      timestamp,
      publicKey,
      subtle,
      PlatformAlgorithm.NewNode,
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: DiscordInteraction;
  try {
    body = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // PING → PONG
  if (body.type === InteractionType.Ping) {
    return NextResponse.json({ type: InteractionResponseType.Pong });
  }

  if (
    body.type === InteractionType.ApplicationCommand &&
    body.data?.name === "stop"
  ) {
    const discordUserId = body.user?.id ?? body.member?.user?.id;
    if (discordUserId) {
      const admin = createSupabaseServiceClient();
      await admin
        .from("external_channel_handles")
        .update({
          verified: false,
          disconnected_reason: "user_command_stop",
          last_disconnected_at: new Date().toISOString(),
        })
        .eq("channel", "discord")
        .eq("platform_id", discordUserId);
    }
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "You've been unsubscribed from Antarix nudges." },
    });
  }

  // MESSAGE_CREATE — best-effort `/start <token>` binding.
  if (body.type === 0) {
    const text = body.message?.content ?? "";
    const m = text.match(/^\/start\s+(\S+)/);
    const startToken = m?.[1];
    if (startToken) {
      const verified = verifyChannelToken(startToken);
      if (verified.ok && verified.token.pr === "discord-oauth-state") {
        const admin = createSupabaseServiceClient();
        await admin.from("external_channel_handles").upsert(
          {
            user_id: verified.token.uid,
            channel: "discord",
            platform_id: body.message?.author?.id ?? "",
            platform_handle: body.user?.username ?? body.member?.user?.username ?? "discord-user",
            dm_channel_id: body.channel_id ?? null,
            verified: true,
            disconnected_reason: null,
            last_verified_at: new Date().toISOString(),
          },
          { onConflict: "user_id,channel" },
        );
      }
    }
  }

  return NextResponse.json({ type: InteractionResponseType.Pong });
}
