import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const CreateBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional(),
  is_public: z.boolean().default(true),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Public cohorts + the user's own cohorts (incl. private)
  const { data: publicCohorts, error } = await supabase
    .from("cohorts")
    .select("id,name,description,cohort_type,member_count,is_public,created_at")
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: myCohorts } = await supabase
    .from("cohorts")
    .select("id,name,description,cohort_type,member_count,is_public,created_at")
    .or(`created_by.eq.${user.id},is_public.eq.false`)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ public: publicCohorts ?? [], mine: myCohorts ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `cohort-create:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();

  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      is_public: parsed.data.is_public,
      cohort_type: "custom",
      invite_code: inviteCode,
      created_by: user.id,
    })
    .select("id,name,invite_code,cohort_type,is_public")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-join creator
  if (data?.id) {
    await supabase.from("cohort_members").insert({ cohort_id: data.id, user_id: user.id });
  }

  return NextResponse.json({ cohort: data });
}
