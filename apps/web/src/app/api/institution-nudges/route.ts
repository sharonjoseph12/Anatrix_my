// apps/web/src/app/api/institution-nudges/route.ts
// T048 — Officer-only endpoint. POST { institution_id, channel, expires_at? }
// → enables a default nudge channel for every member of the institution.
// GET  ?institution_id=... → list current institution_nudge_settings for that
// institution (officers only).
//
// This does NOT create per-user external_channel_handles rows — it just
// records the institution's choice. Members who connect via /api/channels/
// connect will have the "Connected by <institution>" badge rendered from
// this row (see channels-section.tsx).

import { NextResponse } from "next/server";
import { z } from "zod";
import { institutionNudgeSettingsSchema } from "@/lib/validation/schemas";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const QuerySchema = z.object({
  institution_id: z.string().uuid(),
});

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ institution_id: url.searchParams.get("institution_id") });
  if (!parsed.success) return NextResponse.json({ error: "institution_id required" }, { status: 400 });

  const admin = createSupabaseServiceClient();
  // Officer check: caller must be a member of the institution with role=officer.
  const { data: member } = await admin
    .from("institution_members")
    .select("role")
    .eq("institution_id", parsed.data.institution_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || (member as { role: string }).role !== "officer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("institution_nudge_settings")
    .select("channel,enabled,expires_at,created_at")
    .eq("institution_id", parsed.data.institution_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `institution-nudges:${user.id}`, limit: 5, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = institutionNudgeSettingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { institution_id, channel, expires_at } = parsed.data;

  const admin = createSupabaseServiceClient();
  const { data: member } = await admin
    .from("institution_members")
    .select("role")
    .eq("institution_id", institution_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || (member as { role: string }).role !== "officer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("institution_nudge_settings").upsert(
    {
      institution_id,
      channel,
      enabled: true,
      expires_at: expires_at ?? null,
      set_by_user_id: user.id,
    },
    { onConflict: "institution_id,channel" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
