import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Code2, GitCommit, Award, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PerformanceGauge } from "@/components/charts/performance-gauge";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollegeStudentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/college/students/${id}`);

  const { data: officerMembership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .in("role", ["placement_officer", "admin"])
    .limit(1)
    .maybeSingle();
  if (!officerMembership) return null;
  const institutionId = (officerMembership as { institution_id: string }).institution_id;

  // Verify the target student belongs to this institution
  const { data: studentMembership } = await supabase
    .from("institution_members")
    .select("user_id,batch_year,department,roll_number,specialization,joined_at,role")
    .eq("user_id", id)
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .maybeSingle();
  if (!studentMembership) notFound();

  const { data: userRow } = await supabase
    .from("users")
    .select("email,display_name,avatar_url")
    .eq("id", id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("overall_skill_proof_score,primary_specialization,total_hours_logged,total_projects_completed,total_sessions,total_commits,avg_focus_quality,placement_ready,is_public,is_open_to_opportunities,last_updated_at")
    .eq("user_id", id)
    .maybeSingle();

  const { data: skills } = await supabase
    .from("user_skills")
    .select("skill_proof_score,hours_logged,projects_completed,proficiency_level,skill_id")
    .eq("user_id", id)
    .order("skill_proof_score", { ascending: false })
    .limit(8);

  const skillIds = (skills ?? []).map((s) => s.skill_id);
  const { data: skillDefs } = skillIds.length
    ? await supabase
        .from("skills")
        .select("id,name,category")
        .in("id", skillIds)
    : { data: [] };
  const skillDefMap = new Map<string, NonNullable<typeof skillDefs>[number]>();
  for (const s of skillDefs ?? []) skillDefMap.set(s.id, s);

  const { data: recentSessions } = await supabase
    .from("sessions")
    .select("started_at,duration_minutes,focus_level,category,project_name")
    .eq("user_id", id)
    .order("started_at", { ascending: false })
    .limit(10);

  const u = userRow;
  const name = u?.display_name ?? u?.email ?? id.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/college/students">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Back to students
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {u?.email} · {studentMembership.department ?? "—"} · batch {studentMembership.batch_year ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skill proof</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PerformanceGauge value={profile?.overall_skill_proof_score ?? 0} />
          </CardContent>
        </Card>
        <div className="space-y-3 md:col-span-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={<Clock className="h-4 w-4" />} label="Hours" value={profile?.total_hours_logged ?? 0} />
            <Stat icon={<Code2 className="h-4 w-4" />} label="Projects" value={profile?.total_projects_completed ?? 0} />
            <Stat icon={<GitCommit className="h-4 w-4" />} label="Commits" value={profile?.total_commits ?? 0} />
            <Stat icon={<Award className="h-4 w-4" />} label="Sessions" value={profile?.total_sessions ?? 0} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Placement ready</span>
                <Badge variant={profile?.placement_ready ? "default" : "outline"}>
                  {profile?.placement_ready ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Public profile</span>
                <Badge variant={profile?.is_public ? "default" : "outline"}>
                  {profile?.is_public ? "Visible" : "Hidden"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Open to opportunities</span>
                <Badge variant={profile?.is_open_to_opportunities ? "default" : "outline"}>
                  {profile?.is_open_to_opportunities ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top skills</CardTitle>
          <CardDescription>Per-skill breakdown for {name.split(" ")[0]}</CardDescription>
        </CardHeader>
        <CardContent>
          {skills && skills.length > 0 ? (
            <ul className="space-y-3">
              {skills.map((s) => {
                const sk = skillDefMap.get(s.skill_id);
                return (
                  <li key={s.skill_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {sk?.name ?? "Skill"}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({sk?.category ?? "—"})
                        </span>
                      </span>
                      <span className="text-xs font-medium">
                        {s.skill_proof_score} · {s.hours_logged}h · {s.projects_completed} proj
                      </span>
                    </div>
                    <Progress value={s.skill_proof_score} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No skills tracked yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Recent sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSessions && recentSessions.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {recentSessions.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0">
                  <div>
                    <p className="font-medium">{s.project_name ?? s.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.started_at).toLocaleString()} · {s.category} · {s.focus_level}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{s.duration_minutes}m</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recent sessions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
