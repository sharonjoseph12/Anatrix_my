import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const Body = z.object({ code: z.string().trim().min(2).max(60).toUpperCase() }).optional();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `cohort-join:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  // Optional invite code validation
  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (parsed.data?.code) {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("id,invite_code,is_public")
      .eq("id", id)
      .maybeSingle();
    if (!cohort) return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    const c = cohort as { is_public: boolean; invite_code: string | null };
    if (!c.is_public && c.invite_code !== parsed.data.code) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
    }
  }

  // Idempotent join: handle unique conflict silently
  const { error } = await supabase
    .from("cohort_members")
    .insert({ cohort_id: id, user_id: user.id });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
