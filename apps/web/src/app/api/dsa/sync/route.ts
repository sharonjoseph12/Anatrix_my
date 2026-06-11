import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { dsaSyncSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `dsa-sync:${user.id}`, limit: 1, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(dsaSyncSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { platform } = parsed.data;

  const { data: profile, error: pErr } = await supabase
    .from("user_dsa_profiles")
    .select("id,total_solved,easy_solved,medium_solved,hard_solved,contest_rating,streak_days,sync_status,last_synced_at")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Not connected" }, { status: 404 });

  // Trigger the edge function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    fetch(`${supabaseUrl}/functions/v1/dsa-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ user_id: user.id, platform, full_sync: true }),
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, profile });
}
