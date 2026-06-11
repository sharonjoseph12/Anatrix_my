import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PerformanceGauge } from "@/components/charts/performance-gauge";

type Tier = "ready_now" | "development" | "early";

function tierFor(score: number | null, hours: number | null): Tier {
  if (score == null || hours == null) return "early";
  if (score >= 80 && hours >= 200) return "ready_now";
  if (score >= 55 || hours >= 80) return "development";
  return "early";
}

export default async function CollegeDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/college/dashboard");

  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .in("role", ["placement_officer", "admin"])
    .limit(1)
    .maybeSingle();

  if (!membership) return null;
  const institutionId = (membership as { institution_id: string }).institution_id;

  // Aggregate student readiness
  const { data: students } = await supabase
    .from("candidate_profiles")
    .select("user_id,overall_skill_proof_score,total_hours_logged,total_projects_completed,placement_ready,primary_specialization")
    .eq("institution_id", institutionId);

  const list = (students ?? []) as Array<{
    user_id: string;
    overall_skill_proof_score: number | null;
    total_hours_logged: number | null;
    total_projects_completed: number | null;
    placement_ready: boolean | null;
    primary_specialization: string | null;
  }>;

  const readyNow = list.filter((s) => s.placement_ready);
  const development = list.filter(
    (s) => !s.placement_ready && tierFor(s.overall_skill_proof_score, s.total_hours_logged) === "development",
  );
  const early = list.filter((s) => tierFor(s.overall_skill_proof_score, s.total_hours_logged) === "early");
  const avgScore = list.length
    ? Math.round(list.reduce((sum, s) => sum + (s.overall_skill_proof_score ?? 0), 0) / list.length)
    : 0;
  const topPerformers = [...list]
    .sort((a, b) => (b.overall_skill_proof_score ?? 0) - (a.overall_skill_proof_score ?? 0))
    .slice(0, 5);

  // Skill gap: count specializations
  const specCounts = new Map<string, number>();
  for (const s of list) {
    if (s.primary_specialization) {
      specCounts.set(s.primary_specialization, (specCounts.get(s.primary_specialization) ?? 0) + 1);
    }
  }
  const topSpecializations = Array.from(specCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Placement Dashboard</h1>
        <p className="text-muted-foreground">
          {list.length} student{list.length === 1 ? "" : "s"} tracked · avg score {avgScore}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avg score</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PerformanceGauge value={avgScore} label="Cohort" />
          </CardContent>
        </Card>
        <TierCard
          tone="emerald"
          title="Ready now"
          count={readyNow.length}
          description="Score ≥ 80 and ≥ 200h"
        />
        <TierCard
          tone="sky"
          title="Development path"
          count={development.length}
          description="Score ≥ 55 OR ≥ 80h"
        />
        <TierCard
          tone="amber"
          title="Early stage"
          count={early.length}
          description="Building basics"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Top performers
                </CardTitle>
                <CardDescription>Highest verified skill proof scores</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/college/students">
                  All
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No students have activity yet. Import a CSV to get started.
              </p>
            ) : (
              <ul className="space-y-2">
                {topPerformers.map((s) => (
                  <li key={s.user_id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.primary_specialization ?? "Generalist"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.total_hours_logged ?? 0}h · {s.total_projects_completed ?? 0} projects
                      </p>
                    </div>
                    <Badge variant={s.placement_ready ? "default" : "outline"}>
                      {s.overall_skill_proof_score ?? 0}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Skill gaps
            </CardTitle>
            <CardDescription>Top specializations in your cohort</CardDescription>
          </CardHeader>
          <CardContent>
            {topSpecializations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ul className="space-y-2">
                {topSpecializations.map(([name, count]) => (
                  <li key={name} className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Recommendation: Recruit companies that need adjacent skills
              (e.g. {topSpecializations[0]?.[0] ?? "your top specialization"}-adjacent roles).
            </div>
          </CardContent>
        </Card>
      </div>

      {list.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Get started
            </CardTitle>
            <CardDescription>
              Import your students to start seeing verified placement readiness.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/college/students/import">Import students CSV</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TierCard({
  tone,
  title,
  count,
  description,
}: {
  tone: "emerald" | "sky" | "amber";
  title: string;
  count: number;
  description: string;
}) {
  const toneClass = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    sky: "border-sky-500/30 bg-sky-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
  }[tone];
  return (
    <Card className={toneClass}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold">{count}</p>
      </CardContent>
    </Card>
  );
}
