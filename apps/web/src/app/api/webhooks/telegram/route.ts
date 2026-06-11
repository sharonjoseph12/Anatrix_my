// apps/web/src/app/api/webhooks/telegram/route.ts
// T042 — Telegram bot webhook. Verifies `X-Telegram-Bot-Api-Secret-Token`
// (set when calling setWebhook). Handles:
//   - /start <token>  → bind chat_id to the user
//   - /stop           → disconnect the chat
// Anything else is ignored (no echo, no errors).

import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyChannelToken } from "@/lib/channels/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string; username?: string; first_name?: string };
    from?: { id: number; is_bot?: boolean; username?: string; first_name?: string };
    text?: string;
  };
};

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Telegram webhook is not configured" }, { status: 503 });
  }
  const headerToken = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (headerToken !== secret) {
    return NextResponse.json({ error: "Invalid secret token" }, { status: 401 });
  }

  let body: TelegramUpdate;
  try {
    body = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const msg = body.message;
  if (!msg?.text) {
    return NextResponse.json({ ok: true });
  }

  const admin = createSupabaseServiceClient();
  const chatId = String(msg.chat.id);

  // /start <token>
  const start = msg.text.match(/^\/start(?:\s+(\S+))?/);
  if (start) {
    const token = start[1];
    if (!token) {
      // Generic start — send instructions.
      return NextResponse.json({ ok: true, method: "sendMessage" });
    }
    const verified = verifyChannelToken(token);
    if (!verified.ok || verified.token.pr !== "telegram-start" || verified.token.ch !== "telegram") {
      return NextResponse.json({ ok: true, ignored: "invalid_token" });
    }
    await admin.from("external_channel_handles").upsert(
      {
        user_id: verified.token.uid,
        channel: "telegram",
        platform_id: chatId,
        platform_handle: msg.chat.username ?? msg.chat.first_name ?? "telegram-user",
        verified: true,
        disconnected_reason: null,
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: "user_id,channel" },
    );
    return NextResponse.json({ ok: true, bound: true });
  }

  // /stop
  if (/^\/stop\b/.test(msg.text)) {
    await admin
      .from("external_channel_handles")
      .update({
        verified: false,
        disconnected_reason: "user_command_stop",
        last_disconnected_at: new Date().toISOString(),
      })
      .eq("channel", "telegram")
      .eq("platform_id", chatId);
    return NextResponse.json({ ok: true, unbound: true });
  }

  return NextResponse.json({ ok: true });
}
