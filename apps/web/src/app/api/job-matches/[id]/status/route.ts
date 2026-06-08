import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { jobMatchStatusUpdateSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matchId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit({ key: `job-match-status:${user.id}`, limit: 60, windowMs: 60_000 });
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
  const parsed = parseOrError(jobMatchStatusUpdateSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const body = parsed.data;

  // Build updates for status-specific timestamps
  const updates: Record<string, unknown> = {
    status: body.status,
    notes: body.notes ?? null,
  };
  if (body.status === "reached_out") updates.reached_out_at = new Date().toISOString();
  if (body.status === "interview_completed") updates.interview_completed_at = new Date().toISOString();
  if (body.status === "hired") updates.hired_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("job_matches")
    .update(updates)
    .eq("id", matchId)
    .eq("company_id", companyId)
    .select("id,status,reached_out_at,interview_scheduled_at,interview_completed_at,hired_at,candidate_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const updated = data as { candidate_id: string };

  // Notify candidate on status change
  const { data: cand } = await supabase
    .from("candidate_profiles")
    .select("user_id")
    .eq("id", updated.candidate_id)
    .maybeSingle();
  if (cand) {
    const candRow = cand as { user_id: string };
    await supabase.from("notifications").insert({
      user_id: candRow.user_id,
      kind:
        body.status === "interview_scheduled"
          ? "interview_scheduled"
          : body.status === "hired"
            ? "hiring_outcome"
            : "company_interest",
      title:
        body.status === "reached_out"
          ? "A company reached out"
          : body.status === "interview_scheduled"
            ? "Interview scheduled"
            : body.status === "hired"
              ? "You got hired"
              : "Status updated",
      body: `Your application status is now: ${body.status.replace("_", " ")}.`,
      href: "/dashboard",
    });
  }

  return NextResponse.json({ match: data });
}
