import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { interviewScheduleSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: candidateId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit({ key: `recruiter-schedule:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!limit.ok) return rateLimitResponse(limit.resetAt);

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .in("role", ["recruiter", "admin", "hiring_manager"])
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const companyId = (membership as { company_id: string }).company_id;

  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = parseOrError(interviewScheduleSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const body = parsed.data;

  // Compute match score from candidate_profiles
  const { data: candidate } = await supabase
    .from("candidate_profiles")
    .select("id,user_id,overall_skill_proof_score,is_public,is_open_to_opportunities")
    .eq("user_id", candidateId)
    .maybeSingle();
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  const candRow = candidate as {
    id: string;
    user_id: string;
    overall_skill_proof_score: number | null;
    is_public: boolean | null;
    is_open_to_opportunities: boolean | null;
  };

  // Upsert a job_match for this (company, candidate) pair with status=interview_scheduled
  const { data, error } = await supabase
    .from("job_matches")
    .upsert(
      {
        company_id: companyId,
        candidate_id: candRow.id,
        recruiter_id: user.id,
        position_title: body.position_title ?? "Interview scheduled",
        required_skills: body.required_skills ?? [],
        status: "interview_scheduled",
        match_score: candRow.overall_skill_proof_score ?? 0,
        interview_scheduled_at: body.scheduled_for,
        notes: body.notes ?? null,
        format: body.format,
        duration_minutes: body.duration_minutes,
      },
      { onConflict: "company_id,candidate_id" },
    )
    .select("id,status,interview_scheduled_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the candidate via the notifications table
  await supabase.from("notifications").insert({
    user_id: candRow.user_id,
    kind: "interview_scheduled",
    title: `Interview scheduled`,
    body: `A recruiter has scheduled an interview on ${new Date(body.scheduled_for).toLocaleString()}.`,
    href: "/dashboard",
  });

  return NextResponse.json({ match: data });
}
