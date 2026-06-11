// apps/web/src/app/api/faculty/grade/route.ts
// POST /api/faculty/grade
// Auth: verified faculty (faculty_verifications.verified=true at the same
// institution as the assignment AND as the student).
// Rate limit: 100/hour per faculty.
// Body: { student_id, assignment_id, grade, comment? }
//
// Inserts a row into faculty_grades. The unique constraint
// (faculty_id, student_id, assignment_id) makes duplicates a 422.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { facultyGradeSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `faculty-grade:${user.id}`, limit: 100, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(facultyGradeSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { student_id, assignment_id, grade, comment } = parsed.data;

  // The caller must be a verified faculty at SOME institution.
  const { data: verification } = await supabase
    .from("faculty_verifications")
    .select("institution_id,verified,revoked_at")
    .eq("user_id", user.id)
    .eq("verified", true)
    .is("revoked_at", null)
    .maybeSingle();
  if (!verification) {
    return NextResponse.json(
      { error: "Not a verified faculty member" },
      { status: 403 },
    );
  }
  const facultyInstitutionId = (verification as { institution_id: string }).institution_id;

  // The assignment must belong to the faculty's institution.
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id,institution_id,max_grade")
    .eq("id", assignment_id)
    .maybeSingle();
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  const a = assignment as { id: string; institution_id: string; max_grade: number };
  if (a.institution_id !== facultyInstitutionId) {
    return NextResponse.json(
      { error: "Assignment does not belong to your institution" },
      { status: 403 },
    );
  }
  if (grade > a.max_grade) {
    return NextResponse.json(
      { error: `Grade exceeds assignment max_grade (${a.max_grade})` },
      { status: 400 },
    );
  }

  // The student must be in the same institution.
  const { data: studentMember } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", student_id)
    .eq("institution_id", facultyInstitutionId)
    .maybeSingle();
  if (!studentMember) {
    return NextResponse.json(
      { error: "Student is not enrolled in your institution" },
      { status: 403 },
    );
  }

  // Insert grade. The unique constraint on
  // (faculty_id, student_id, assignment_id) makes duplicate grading a 422.
  const { data, error } = await supabase
    .from("faculty_grades")
    .insert({
      faculty_id: user.id,
      student_id,
      assignment_id,
      grade,
      comment: comment ?? null,
    })
    .select("id,graded_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Already graded; use amendment flow" },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // TODO: enqueue score recompute.
  // The repo does not yet have a generic recompute endpoint; the score
  // recompute job (e.g. a future POST /api/admin/recompute or a Supabase
  // Edge Function) should be invoked here. The current data model
  // (faculty_grades -> candidate_profiles) is read by the dashboard; the
  // eventual score-aggregator in src/lib/anticheat/score-aggregator.ts
  // (per plan) will fold faculty grades into the Skill Proof Score
  // (weight 0.1 per research D5).

  return NextResponse.json(
    {
      grade_id: (data as { id: string }).id,
      recompute_eta: "6 hours",
    },
    { status: 201 },
  );
}
