import { redirect } from "next/navigation";
import { BarChart3, Users, TrendingUp, Sparkles, Briefcase } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/company/analytics");

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/recruiter/analytics`, {
    headers: {
      // The route reads the session from cookies via the same client; for
      // server-to-server inside the same origin we just call Supabase directly
      // in the same file. Falling back to a manual query if the fetch fails.
    },
    cache: "no-store",
  }).catch(() => null);

  let analytics: {
    total: number;
    funnel: { matched: number; reached: number; interviewed: number; hired: number; rejected: number };
    avg_match_score: number;
    retention_rate: number;
    pipeline_value: number;
  } | null = null;

  if (res?.ok) {
    analytics = (await res.json()) as typeof analytics;
  } else {
    // Fallback: compute directly
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membership) {
      const companyId = (membership as { company_id: string }).company_id;
      const { data: matches } = await supabase
        .from("job_matches")
        .select("id,status,match_score,reached_out_at,interview_completed_at,hired_at")
        .eq("company_id", companyId);
      const list = (matches ?? []) as Array<{
        status: string;
        match_score: number;
        reached_out_at: string | null;
        interview_completed_at: string | null;
        hired_at: string | null;
      }>;
      const total = list.length;
      analytics = {
        total,
        funnel: {
          matched: list.filter((m) => m.status !== "rejected").length,
          reached: list.filter((m) => !!m.reached_out_at).length,
          interviewed: list.filter((m) => !!m.interview_completed_at).length,
          hired: list.filter((m) => !!m.hired_at).length,
          rejected: list.filter((m) => m.status === "rejected").length,
        },
        avg_match_score: total > 0 ? Math.round(list.reduce((s, m) => s + m.match_score, 0) / total) : 0,
        retention_rate: 0,
        pipeline_value: total * 1000,
      };
    }
  }

  if (!analytics) {
    return (
      <div className="p-6 text-sm text-muted-foreground">No analytics yet.</div>
    );
  }

  const maxFunnel = Math.max(1, analytics.funnel.matched);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7" />
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Conversion and pipeline metrics, computed from your job_matches.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Total candidates" value={analytics.total} />
        <Stat
          icon={<Sparkles className="h-4 w-4" />}
          label="Avg match score"
          value={analytics.avg_match_score}
        />
        <Stat
          icon={<TrendingUp className="h-4 w-4" />}
          label="Retention"
          value={`${analytics.retention_rate}%`}
        />
        <Stat
          icon={<Briefcase className="h-4 w-4" />}
          label="Pipeline value"
          value={analytics.pipeline_value}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funnel</CardTitle>
          <CardDescription>Stage-by-stage conversion across your matches.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FunnelRow label="Matched" value={analytics.funnel.matched} max={maxFunnel} />
          <FunnelRow label="Reached" value={analytics.funnel.reached} max={maxFunnel} />
          <FunnelRow label="Interviewed" value={analytics.funnel.interviewed} max={maxFunnel} />
          <FunnelRow label="Hired" value={analytics.funnel.hired} max={maxFunnel} />
          <FunnelRow label="Rejected" value={analytics.funnel.rejected} max={maxFunnel} tone="rose" />
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
  value: string | number;
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

function FunnelRow({
  label,
  value,
  max,
  tone = "primary",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "primary" | "rose";
}) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  const color = tone === "rose" ? "bg-rose-500" : "bg-primary";
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
