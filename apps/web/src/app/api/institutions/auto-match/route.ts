import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const Body = z.object({
  company_id: z.string().uuid(),
  institution_id: z.string().uuid(),
  min_score: z.number().int().min(0).max(100).default(60),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `auto-match:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const { company_id, institution_id, min_score } = parsed.data;

  // Caller must be an officer of the target institution
  const { data: officer } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .in("role", ["placement_officer", "admin"])
    .eq("institution_id", institution_id)
    .limit(1)
    .maybeSingle();
  if (!officer) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  // 1. Pull this institution's placement-ready students
  const { data: students, error: sErr } = await supabase
    .from("candidate_profiles")
    .select(`
      id, user_id, overall_skill_proof_score, primary_specialization,
      specialization_scores, is_open_to_opportunities
    `)
    .eq("institution_id", institution_id)
    .eq("placement_ready", true)
    .gte("overall_skill_proof_score", min_score);

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  const studentRows = (students ?? []) as Array<{
    id: string;
    user_id: string;
    overall_skill_proof_score: number;
    primary_specialization: string | null;
    specialization_scores: unknown;
    is_open_to_opportunities: boolean;
  }>;

  // 2. Find a recruiter to attach matches to (first recruiter of the company)
  const { data: companyMembers, error: cmErr } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("company_id", company_id)
    .limit(1);
  if (cmErr) return NextResponse.json({ error: cmErr.message }, { status: 500 });
  const recruiterId = companyMembers?.[0]?.user_id;
  if (!recruiterId) {
    return NextResponse.json(
      { error: "Company has no recruiter to assign matches to" },
      { status: 400 },
    );
  }

  // 3. Insert job_matches (idempotent via unique index if present)
  let matched = 0;
  for (const s of studentRows) {
    const score = s.overall_skill_proof_score;
    const { error: jErr } = await supabase.from("job_matches").upsert(
      {
        company_id,
        candidate_id: s.id,
        recruiter_id: recruiterId,
        position_title: s.primary_specialization ?? "Verified candidate",
        match_score: score,
        skills_match: score,
        experience_match: score,
        availability_match: s.is_open_to_opportunities ? 100 : 50,
        status: "matched",
      },
      { onConflict: "company_id,candidate_id", ignoreDuplicates: true },
    );
    if (!jErr) matched += 1;
  }

  return NextResponse.json({ matched, total: studentRows.length });
}
