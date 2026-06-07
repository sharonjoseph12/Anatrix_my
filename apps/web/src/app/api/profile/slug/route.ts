import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const Body = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `slug-claim:${user.id}`, limit: 5, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  const { slug } = parsed.data;

  // Reserved?
  const RESERVED = new Set([
    "admin","login","signup","dashboard","college","company","verify","settings","api","_next",
    "onboarding","about","pricing","contact","help","legal","privacy","terms","static","public",
    "assets","u","callback","applications","search","results","pipeline","analytics","ai-coach","credential",
  ]);
  if (RESERVED.has(slug)) {
    return NextResponse.json({ error: "This handle is reserved" }, { status: 409 });
  }

  // Service-role client to bypass RLS for ownership check + conflict scan.
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseServiceClient();

  const { data: existing } = await admin
    .from("candidate_profiles")
    .select("user_id,slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existing && (existing as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "This handle is already taken" }, { status: 409 });
  }

  // No-op if user already owns it.
  if (existing && (existing as { user_id: string }).user_id === user.id) {
    return NextResponse.json({ ok: true, slug, changed: false });
  }

  // upsert: trigger on `slug` write inserts into slug_redirects (017 migration).
  const { error } = await admin
    .from("candidate_profiles")
    .upsert(
      { user_id: user.id, slug, last_updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, slug, changed: true });
}
