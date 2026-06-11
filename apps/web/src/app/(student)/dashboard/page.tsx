import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, ArrowRight, Flame, TrendingUp, MessageCircle,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PerformanceGauge, WeeklyStatsBar } from "./_components/charts.client";
import { IntegrationsClient } from "@/components/dashboard/integrations-client";
import type { Integration } from "@/components/dashboard/integration-status";
import { greetingForHour } from "@/lib/dashboard-helpers";
import { computeProfileScore } from "@/lib/algorithms/profile-score";
import { DayOneInsights } from "./_components/DayOneInsights";
import { PowerModeInvite } from "@/components/onboarding/PowerModeInvite";
import { ConnectWhatsAppCard } from "./_components/ConnectWhatsAppCard";
import { StatusPills } from "./_components/StatusPills";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name,goals,power_mode_active,company_search_visible,whatsapp_opt_in")
    .eq("id", user.id)
    .single();

  const { count: sessionCount } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: commitCount } = await supabase
    .from("github_activity")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: candidateProfile } = await supabase
    .from("candidate_profiles")
    .select("overall_skill_proof_score,primary_specialization,total_hours_logged,placement_ready,total_commits")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: gh } = await supabase
    .from("github_accounts")
    .select("username,status,last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: cal } = await supabase
    .from("calendar_accounts")
    .select("email,status,last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const integrations: Integration[] = [
    {
      provider: "github",
      status: gh ? (gh.status as Integration["status"]) : "not_connected",
      username: gh?.username ?? null,
      last_synced_at: gh?.last_synced_at ?? null,
    },
    {
      provider: "google_calendar",
      status: cal ? (cal.status as Integration["status"]) : "not_connected",
      email: cal?.email ?? null,
      last_synced_at: cal?.last_synced_at ?? null,
    },
  ];

  const { data: insights } = await supabase
    .from("insights")
    .select("id,type,title,description,metric_value,metric_unit,confidence,data_points,recommended_action")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSessions } = await supabase
    .from("sessions")
    .select("started_at,duration_minutes")
    .eq("user_id", user.id)
    .gte("started_at", sevenDaysAgo);
  const { data: recentCommits } = await supabase
    .from("github_activity")
    .select("committed_at")
    .eq("user_id", user.id)
    .gte("committed_at", sevenDaysAgo);

  const weeklyStats = buildWeeklyStats(recentSessions ?? [], recentCommits ?? []);

  const greetingName = profile?.display_name?.split(" ")[0] ?? "there";
  const greeting = greetingForHour();
  const hasAnyData = (commitCount ?? 0) > 0 || (sessionCount ?? 0) > 0;
  const overall = candidateProfile?.overall_skill_proof_score
    ?? computeProfileScore({ skillScores: [], totalHoursLogged: 0 }).overall;

  const topInsight = insights?.[0] ?? null;
  const peakWindowInsight = insights?.find((i) => i.type === "peak_window") ?? null;
  const workflowInsight = insights?.find((i) => i.type === "workflow_pattern") ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}, {greetingName}
        </h1>
        <p className="text-muted-foreground">
          {hasAnyData
            ? "Your verified skill profile is live."
            : "Connect GitHub to see your real Day-1 insights."}
        </p>
        <div className="mt-3">
          <StatusPills />
        </div>
      </div>

      {/* T028 — Day-1 insights appear here for any student with any GitHub data.
          No more 7-day wait. */}
      <DayOneInsights />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Performance score</CardTitle>
            <CardDescription>Composite of skill proof + activity breadth.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <PerformanceGauge value={overall} label="Overall" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended action</CardTitle>
            <CardDescription>What to focus on today.</CardDescription>
          </CardHeader>
          <CardContent>
            {topInsight ? (
              <div className="space-y-3">
                <Badge variant="outline">{topInsight.type.replace("_", " ")}</Badge>
                <p className="text-sm font-medium">{topInsight.title}</p>
                {topInsight.recommended_action && (
                  <p className="text-sm text-muted-foreground">
                    {topInsight.recommended_action}
                  </p>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/insights">
                    See all insights <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Once you have a few days of activity, your top recommendation will appear here.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly activity</CardTitle>
            <CardDescription>Last 7 days · sessions + commits</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyStatsBar data={weeklyStats} />
          </CardContent>
        </Card>
      </div>

      {(peakWindowInsight || workflowInsight) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {peakWindowInsight && (
            <AlertCard
              tone="violet"
              icon={<Flame className="h-4 w-4" />}
              label="Peak window"
              title={peakWindowInsight.title}
              description={peakWindowInsight.description ?? ""}
            />
          )}
          {workflowInsight && (
            <AlertCard
              tone="sky"
              icon={<TrendingUp className="h-4 w-4" />}
              label="Workflow pattern"
              title={workflowInsight.title}
              description={workflowInsight.description ?? ""}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* T031 — Power Mode invite (becomes "active" card once telemetry confirms install) */}
        <PowerModeInvite initialActive={!!profile?.power_mode_active} />

        {/* T032 — WhatsApp connect affordance */}
        <ConnectWhatsAppCard initialOptedIn={!!profile?.whatsapp_opt_in} />
      </div>

      <IntegrationsClient integrations={integrations} />
    </div>
  );
}

function AlertCard({
  tone, icon, label, title, description,
}: {
  tone: "violet" | "sky" | "amber" | "rose";
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
}) {
  const toneClass = {
    violet: "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300",
  }[tone];
  return (
    <Card className={toneClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}{label}
        </CardTitle>
        <CardDescription className="text-current/80">{title}</CardDescription>
      </CardHeader>
      {description && (
        <CardContent>
          <p className="text-sm">{description}</p>
        </CardContent>
      )}
    </Card>
  );
}

function buildWeeklyStats(
  sessions: Array<{ started_at: string; duration_minutes: number | null }>,
  commits: Array<{ committed_at: string }>,
) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const stats: Record<string, { hours: number; sessions: number; commits: number }> = {};
  for (const d of days) stats[d] = { hours: 0, sessions: 0, commits: 0 };
  for (const s of sessions) {
    const d = days[new Date(s.started_at).getDay()]!;
    const entry = stats[d]!;
    entry.sessions += 1;
    entry.hours += (s.duration_minutes ?? 0) / 60;
  }
  for (const c of commits) {
    const d = days[new Date(c.committed_at).getDay()]!;
    const entry = stats[d]!;
    entry.commits += 1;
  }
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order.map((label) => ({ label, ...stats[label]! }));
}
