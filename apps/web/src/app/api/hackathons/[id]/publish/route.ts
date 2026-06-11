import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Recruiter publishes a draft hackathon. The RLS policy on
// `hackathons` already enforces `auth.uid() = recruiter_id` for
// UPDATE, so a non-owner will get a Postgres permission error
// (Postgres error code 42501).
export async function POST(_req: Request, ctx: Params) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const rl = rateLimit({ key: `hackathon-publish:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const { data, error } = await supabase
    .from("hackathons")
    .update({ status: "live" })
    .eq("id", id)
    .eq("recruiter_id", user.id)
    .select("id,status")
    .maybeSingle();

  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found or not the owner" }, { status: 404 });
  }

  return NextResponse.json({ status: (data as { status: string }).status });
}
