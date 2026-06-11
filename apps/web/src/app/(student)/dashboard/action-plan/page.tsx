"use client";

// T069 supplementary — A dedicated "what to work on" page that expands on
// the placement prediction's top_gaps into a concrete weekly action plan.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const GAP_TO_ACTION: Record<string, { action: string; link: string; minutes: number }> = {
  "Session quality": { action: "Try a 25-min Power Mode session on a real task", link: "/dashboard/sessions", minutes: 25 },
  "GitHub commit cadence": { action: "Commit at least one small change per day this week", link: "/dashboard/github", minutes: 15 },
  "Pull request volume": { action: "Open 1 PR against an open-source project", link: "/dashboard/skills", minutes: 60 },
  "Issue a verified credential": { action: "Reach a Skill Proof Score of 60 to unlock your first credential", link: "/credential", minutes: 0 },
  "Total focused time": { action: "Schedule three 45-min focus blocks this week", link: "/ai-coach", minutes: 45 },
  "Streak": { action: "Complete a 10-min Power Mode session today to keep the streak alive", link: "/dashboard", minutes: 10 },
};

export function ActionPlan() {
  const [gaps, setGaps] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("placement_predictions")
        .select("top_gaps").eq("user_id", user.id)
        .order("run_week", { ascending: false }).limit(1).maybeSingle();
      setGaps(((data?.top_gaps as string[] | null) ?? []).slice(0, 3));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="h-32 animate-pulse rounded-md bg-muted" />;
  if (!gaps || gaps.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Action plan</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No gaps identified yet — your placement prediction runs every Monday 03:00 UTC.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {gaps.map((gap) => {
        const plan = GAP_TO_ACTION[gap] ?? { action: `Work on: ${gap}`, link: "/dashboard", minutes: 30 };
        return (
          <Card key={gap}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <Badge variant="secondary" className="mb-1">{gap}</Badge>
                <p className="text-sm font-medium">{plan.action}</p>
                {plan.minutes > 0 && <p className="text-xs text-muted-foreground">~{plan.minutes} min</p>}
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={plan.link}>Go <ArrowRight className="ml-1 h-3 w-3" /></a>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Your action plan</h1>
      <p className="text-sm text-muted-foreground">Three concrete steps from your latest placement prediction.</p>
      <ActionPlan />
    </div>
  );
}
