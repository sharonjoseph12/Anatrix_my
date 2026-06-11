// apps/web/src/app/(college)/faculty/grade/page.tsx
// Server component. Renders the faculty grading form.
// - Assignment dropdown: faculty's institution's assignments
// - Student dropdown: faculty's institution's students
// - Grade input (0..100), comment textarea
// Submission is handled by FacultyGradeForm (client component) which
// POSTs to /api/faculty/grade.

import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FacultyGradeForm } from "./faculty-grade-form";

export default async function CollegeFacultyGradePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/faculty/grade");

  // Caller must be a verified faculty at some institution.
  const { data: verification } = await supabase
    .from("faculty_verifications")
    .select("institution_id,verified,revoked_at")
    .eq("user_id", user.id)
    .eq("verified", true)
    .is("revoked_at", null)
    .maybeSingle();
  if (!verification) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-7 w-7" />
          Grade assignments
        </h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You aren&apos;t a verified faculty member. Ask your institution
            admin to verify you via the faculty verification flow.
          </CardContent>
        </Card>
      </div>
    );
  }
  const institutionId = (verification as { institution_id: string }).institution_id;

  const [{ data: assignments }, { data: members }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id,title,course_code,max_grade")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("institution_members")
      .select("user_id,role,batch_year,department,users:public.users(id,email,display_name)")
      .eq("institution_id", institutionId)
      .eq("role", "student")
      .order("joined_at", { ascending: false })
      .limit(500),
  ]);

  type AssignmentRow = { id: string; title: string; course_code: string | null; max_grade: number };
  type MemberRow = {
    user_id: string;
    role: string;
    batch_year: number | null;
    department: string | null;
    users: { id: string; email: string; display_name: string | null } | null;
  };

  const assignmentList = ((assignments ?? []) as unknown as AssignmentRow[]);
  const studentList = (((members ?? []) as unknown) as MemberRow[])
    .map((m) => {
      const u = m.users;
      return {
        user_id: m.user_id,
        label:
          [u?.display_name ?? u?.email ?? m.user_id.slice(0, 8)].join("") +
          (m.batch_year ? ` (${m.batch_year})` : "") +
          (m.department ? ` · ${m.department}` : ""),
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-7 w-7" />
          Grade assignments
        </h1>
        <p className="text-muted-foreground">
          Issue a grade for a student-assignment pair. Duplicate grades return
          422 &mdash; use the amendment flow for revisions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New grade</CardTitle>
          <CardDescription>
            Faculty grades contribute up to 10% of a student&apos;s Skill Proof
            Score (research D5).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentList.length === 0 || studentList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {assignmentList.length === 0
                ? "No assignments exist at your institution yet."
                : "No students enrolled at your institution yet."}
            </p>
          ) : (
            <FacultyGradeForm
              assignments={assignmentList.map((a) => ({
                id: a.id,
                label: `${a.title}${a.course_code ? ` · ${a.course_code}` : ""}`,
                max_grade: a.max_grade,
              }))}
              students={studentList}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent grades you issued</CardTitle>
          <CardDescription>Last 20 grades</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentGrades userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}

async function RecentGrades({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: grades } = await supabase
    .from("faculty_grades")
    .select("id,student_id,assignment_id,grade,comment,graded_at,assignments(title,max_grade)")
    .eq("faculty_id", userId)
    .order("graded_at", { ascending: false })
    .limit(20);

  type Row = {
    id: string;
    student_id: string;
    assignment_id: string;
    grade: number;
    comment: string | null;
    graded_at: string;
    assignments: { title: string; max_grade: number } | null;
  };
  const list = ((grades ?? []) as unknown) as Row[];

  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">No grades yet.</p>;
  }
  return (
    <ul className="divide-y">
      {list.map((g) => (
        <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{g.assignments?.title ?? g.assignment_id}</p>
            <p className="text-xs text-muted-foreground">
              student {g.student_id.slice(0, 8)} ·{" "}
              {new Date(g.graded_at).toLocaleString()}
            </p>
            {g.comment ? (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{g.comment}</p>
            ) : null}
          </div>
          <Badge variant="outline">
            {g.grade}/{g.assignments?.max_grade ?? 100}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
