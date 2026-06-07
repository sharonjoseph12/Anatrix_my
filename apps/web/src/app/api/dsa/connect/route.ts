import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { dsaConnectSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `dsa-connect:${user.id}`, limit: 5, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(dsaConnectSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { platform, username, force } = parsed.data;

  // Check for an existing connection
  const { data: existing } = await supabase
    .from("user_dsa_profiles")
    .select("id,username")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .maybeSingle();

  if (existing && !force) {
    return NextResponse.json(
      { error: "Platform already connected", existing_username: (existing as { username: string }).username },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("user_dsa_profiles")
    .upsert(
      {
        user_id: user.id,
        platform,
        username,
        sync_status: "pending",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    )
    .select("id,platform,username,sync_status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget manual sync (rate-limited upstream by the edge function)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    fetch(`${supabaseUrl}/functions/v1/dsa-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ user_id: user.id, platform }),
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, profile: data });
}
