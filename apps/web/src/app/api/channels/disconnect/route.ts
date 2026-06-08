// apps/web/src/app/api/channels/disconnect/route.ts
// T040 — POST { channel, reason? } → soft-deletes the handle (keeps audit row
// by setting disconnected_reason + last_disconnected_at).

import { NextResponse } from "next/server";
import { channelDisconnectSchema } from "@/lib/validation/schemas";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `channels-disconnect:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = channelDisconnectSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { channel, reason } = parsed.data;

  const admin = createSupabaseServiceClient();
  const { error } = await admin
    .from("external_channel_handles")
    .update({
      verified: false,
      disconnected_reason: reason ?? "user_requested",
      last_disconnected_at: new Date().toISOString(),
      access_token: null,
      refresh_token: null,
    })
    .eq("user_id", user.id)
    .eq("channel", channel);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
