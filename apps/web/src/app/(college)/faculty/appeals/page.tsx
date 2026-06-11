import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DecideButtons } from "./decide-buttons";

interface PendingAppeal {
  id: string;
  signal_id: string;
  student_id: string;
  explanation: string;
  evidence_url: string | null;
  created_at: string;
  signal: Array<{
    id: string;
    signal: string;
    confidence: number;
    entity_type: "github_repo" | "dsa_record";
    evidence_payload: Record<string, unknown> | null;
    student: { id: string; email: string | null; display_name: string | null } | null;
  }> | null;
}

export default async function FacultyAppealsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/faculty/appeals");

  // Mentor must be at least a faculty member at some institution.
  const { data: myMembership } = await supabase
    .from("institution_members")
    .select("institution_id, role")
    .eq("user_id", user.id)
    .in("role", ["admin", "placement_officer", "faculty"]);
  if (!myMembership || myMembership.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Anti-cheat appeals</h1>
        <Card>
          <CardHeader>
            <CardTitle>Not authorised</CardTitle>
            <CardDescription>
              You need to be a faculty, admin, or placement officer at an institution to
              review anti-cheat appeals.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  const myInstitutionIds = (myMembership as Array<{ institution_id: string }>).map(
    (m) => m.institution_id,
  );

  // Find students at any of the mentor's institutions.
  const { data: students } = await supabase
    .from("institution_members")
    .select("user_id")
    .in("institution_id", myInstitutionIds)
    .eq("role", "student");
  const studentIds = Array.from(
    new Set(((students ?? []) as Array<{ user_id: string }>).map((s) => s.user_id)),
  );

  if (studentIds.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Anti-cheat appeals</h1>
        <Card>
          <CardHeader>
            <CardTitle>No students at your institution yet</CardTitle>
            <CardDescription>
              Appeals will appear here once students at your institution file them.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { data: appeals } = await supabase
    .from("anticheat_appeals")
    .select(
      `id, signal_id, student_id, explanation, evidence_url, created_at,
       signal:anticheat_signals!inner(
         id, signal, confidence, entity_type, evidence_payload,
         student:users!anticheat_signals_student_id_fkey(id, email, display_name)
       )`,
    )
    .eq("status", "pending")
    .in("student_id", studentIds)
    .order("created_at", { ascending: true })
    .returns<PendingAppeal[]>();

  const list = appeals ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Anti-cheat appeals</h1>
        <p className="text-muted-foreground">
          {list.length} pending appeal{list.length === 1 ? "" : "s"} from students at your
          institution.
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Inbox zero</CardTitle>
            <CardDescription>
              No appeals need your review right now. New ones will show up here as students
              file them.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((a) => {
            const sig = a.signal?.[0] ?? null;
            const student = sig?.student ?? null;
            const studentName =
              student?.display_name ?? student?.email ?? a.student_id.slice(0, 8);
            const evidence = sig?.evidence_payload ?? {};
            const repoFullName = (evidence["repo_full_name"] as string | undefined) ?? null;
            const platform = (evidence["platform"] as string | undefined) ?? null;
            const subject =
              sig?.entity_type === "dsa_record"
                ? `DSA · ${platform ?? "profile"}`
                : `Repo · ${repoFullName ?? sig?.entity_type}`;
            return (
              <Card key={a.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldAlert className="h-4 w-4 text-amber-600" />
                        {subject}
                      </CardTitle>
                      <CardDescription>
                        {studentName} · {sig?.signal ?? "unknown"} · confidence{" "}
                        {Math.round((sig?.confidence ?? 0) * 100)}% · filed{" "}
                        {new Date(a.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Student explanation
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{a.explanation}</p>
                  </div>
                  {a.evidence_url ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                      <Button asChild size="sm" variant="link" className="h-auto p-0">
                        <a href={a.evidence_url} target="_blank" rel="noreferrer">
                          {a.evidence_url}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  ) : null}
                  {repoFullName ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Repo</p>
                      <Button asChild size="sm" variant="link" className="h-auto p-0">
                        <a
                          href={`https://github.com/${repoFullName}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {repoFullName}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  ) : null}
                  <DecideButtons appealId={a.id} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
