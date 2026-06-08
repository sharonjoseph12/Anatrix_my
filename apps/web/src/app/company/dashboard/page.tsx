import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Briefcase, Sparkles, ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function CompanyDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/company/dashboard");

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  const companyId = (membership as { company_id: string }).company_id;

  const { data: matches } = await supabase
    .from("job_matches")
    .select("id,status,position_title,match_score,reached_out_at,interview_scheduled_at,interview_completed_at,hired_at,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const list = (matches ?? []) as Array<{
    id: string;
    status: string;
    position_title: string | null;
    match_score: number;
    created_at: string;
  }>;

  const matched = list.filter((m) => m.status === "matched").length;
  const reached = list.filter((m) => m.status === "reached_out").length;
  const scheduled = list.filter((m) => m.status === "interview_scheduled").length;
  const hired = list.filter((m) => m.status === "hired").length;
  const total = list.length;
  const conversionRate = total > 0 ? Math.round((hired / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7" />
          Recruiter dashboard
        </h1>
        <p className="text-muted-foreground">
          Track your pipeline from match → interview → hire.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={<Sparkles className="h-4 w-4" />} label="Matched" value={matched} />
        <Stat icon={<Users className="h-4 w-4" />} label="Reached out" value={reached} />
        <Stat icon={<Briefcase className="h-4 w-4" />} label="Interviews" value={scheduled} />
        <Stat icon={<Briefcase className="h-4 w-4" />} label="Hired" value={hired} />
        <Stat icon={<Sparkles className="h-4 w-4" />} label="Conversion" value={`${conversionRate}%`} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Recent matches</CardTitle>
              <CardDescription>
                {total} match{total === 1 ? "" : "es"} so far
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/company/search">
                New search
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No matches yet. Run a search to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {list.slice(0, 8).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.position_title ?? "Verified candidate"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()} · match {m.match_score}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {m.status.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
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
