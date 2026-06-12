import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;
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
