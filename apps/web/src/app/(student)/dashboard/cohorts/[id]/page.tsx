import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Users, Sparkles, Clock, TrendingUp } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ComparisonChart, AdvantageCell, type ComparisonMetric } from "@/components/dashboard/comparison-chart";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export default async function CohortComparisonPage({ params }: RouteProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/cohorts/${id}`);

  // Verify membership
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id,name,description,member_count")
    .eq("id", id)
    .single();

  if (!cohort) notFound();

  const { data: isMember } = await supabase
    .from("cohort_members")
    .select("id")
    .eq("cohort_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!isMember) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{cohort.name}</h1>
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re not a member</CardTitle>
            <CardDescription>
              Join this cohort from the Cohorts page to see comparison metrics.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { data: comparison } = await supabase.rpc("cohort_compare", {
    p_user_id: user.id,
    p_cohort_id: id,
  });

  type CompareShape = {
    user?: {
      overall_score?: number;
      avg_focus_quality?: number;
      peak_start_hour?: number | null;
    };
    cohort?: {
      member_count?: number;
      avg_focus_quality?: number;
      avg_overall_score?: number;
      median_peak_hour?: number | null;
      top_category?: string | null;
      total_sessions?: number;
      total_hours?: number;
    };
    advantages?: {
      score?: number;
      focus?: number;
      peak_alignment?: number | null;
    };
  };

  const cmp = (comparison as CompareShape | null) ?? null;
  const u = cmp?.user ?? {};
  const c = cmp?.cohort ?? {};
  const adv = cmp?.advantages ?? {};

  const metrics: ComparisonMetric[] = [
    {
      label: "Score",
      user: u.overall_score ?? 0,
      cohort: c.avg_overall_score ?? 0,
    },
    {
      label: "Focus",
      user: Math.round((u.avg_focus_quality ?? 0) * 100),
      cohort: Math.round((c.avg_focus_quality ?? 0) * 100),
    },
    {
      label: "Hours (30d)",
      user: 0,
      cohort: c.total_hours ?? 0,
      higherIsBetter: true,
    },
    {
      label: "Sessions (30d)",
      user: 0,
      cohort: c.total_sessions ?? 0,
      higherIsBetter: true,
    },
    {
      label: "Members",
      user: 1,
      cohort: Math.max(2, c.member_count ?? 0),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7" />
            {cohort.name}
          </h1>
          {cohort.description && (
            <p className="text-muted-foreground">{cohort.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {c.member_count ?? cohort.member_count ?? 0} members
          </Badge>
          {c.top_category && <Badge variant="secondary">top: {c.top_category}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AdvantageCard
          tone="violet"
          icon={<Sparkles className="h-4 w-4" />}
          label="Skill proof score"
          userValue={u.overall_score ?? 0}
          cohortValue={c.avg_overall_score ?? 0}
          delta={adv.score ?? 0}
        />
        <AdvantageCard
          tone="sky"
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg focus quality"
          userValue={Math.round((u.avg_focus_quality ?? 0) * 100)}
          cohortValue={Math.round((c.avg_focus_quality ?? 0) * 100)}
          delta={adv.focus ?? 0}
          suffix="%"
        />
        <AdvantageCard
          tone="emerald"
          icon={<Clock className="h-4 w-4" />}
          label="Peak alignment"
          userValue={u.peak_start_hour ?? 0}
          cohortValue={c.median_peak_hour ?? 0}
          delta={adv.peak_alignment == null ? 0 : -adv.peak_alignment}
          suffix="h"
          higherIsBetter
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>You vs Cohort</CardTitle>
          <CardDescription>
            Higher focus and score are better. Peak alignment is the hour
            difference from the cohort&apos;s median peak window (lower = better).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComparisonChart metrics={metrics} />
        </CardContent>
      </Card>
    </div>
  );
}

function AdvantageCard({
  tone,
  icon,
  label,
  userValue,
  cohortValue,
  delta,
  suffix = "",
  higherIsBetter = false,
}: {
  tone: "violet" | "sky" | "emerald";
  icon: React.ReactNode;
  label: string;
  userValue: number;
  cohortValue: number;
  delta: number;
  suffix?: string;
  higherIsBetter?: boolean;
}) {
  const toneClass = {
    violet: "border-violet-500/30",
    sky: "border-sky-500/30",
    emerald: "border-emerald-500/30",
  }[tone];
  return (
    <Card className={toneClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">
          {userValue}
          <span className="text-base font-normal text-muted-foreground">
            {suffix}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cohort: {cohortValue}
          {suffix}
        </p>
        <div className="mt-2">
          <AdvantageCell
            delta={Math.round(delta * 100) / 100}
            higherIsBetter={higherIsBetter}
            suffix={suffix}
          />
        </div>
      </CardContent>
    </Card>
  );
}
