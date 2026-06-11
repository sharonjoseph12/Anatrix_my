import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const Body = z.object({
  is_public: z.boolean(),
  is_open_to_opportunities: z.boolean(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/)
    .optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit({ key: `profile-vis:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { is_public, is_open_to_opportunities, slug } = parsed.data;

  // Upsert into candidate_profiles. Other fields are populated by the
  // update-profiles edge function (or via SQL triggers for new profiles).
  const update: Record<string, unknown> = {
    user_id: user.id,
    is_public,
    is_open_to_opportunities,
    last_updated_at: new Date().toISOString(),
  };
  if (slug) update.slug = slug;

  const { error } = await supabase
    .from("candidate_profiles")
    .upsert(update, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_public, is_open_to_opportunities, slug });
}
