"use client";

// T069 — PlacementPredictionCard: shows probability, tier, time-to-ready, top-3
// gap chips with recommended actions. Renders a "X days remaining" placeholder
// for users below the prediction minimum.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Prediction = {
  probability_0_100: number;
  company_tier: string;
  time_to_ready_months: number;
  top_gaps: string[];
  run_week: string;
};

const MIN_DAYS = 30;

export function PlacementPredictionCard() {
  const [data, setData] = useState<Prediction | null | "below_threshold" | "loading">("loading");
  const [daysActive, setDaysActive] = useState<number>(0);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: firstSession } = await supabase.from("sessions")
        .select("started_at").eq("user_id", user.id).order("started_at", { ascending: true }).limit(1).maybeSingle();
      const firstActive = firstSession?.started_at ? new Date(firstSession.started_at) : null;
      const days = firstActive ? Math.floor((Date.now() - firstActive.getTime()) / 86_400_000) : 0;
      setDaysActive(days);
      if (days < MIN_DAYS) { setData("below_threshold"); return; }
      const { data: pred } = await supabase.from("placement_predictions")
        .select("probability_0_100,company_tier,time_to_ready_months,top_gaps,run_week")
        .eq("user_id", user.id).order("run_week", { ascending: false }).limit(1).maybeSingle();
      setData((pred as Prediction) ?? null);
    })();
  }, []);

  if (data === "loading") return <div className="h-40 animate-pulse rounded-md bg-muted" />;
  if (data === "below_threshold") {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Placement prediction</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {MIN_DAYS - daysActive} more days of activity and your first placement prediction unlocks.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Placement prediction</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No prediction yet — it runs every Monday 03:00 UTC.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Placement prediction</CardTitle>
        <Badge>{data.company_tier}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tabular-nums">{data.probability_0_100}%</span>
            <span className="text-xs text-muted-foreground">~{data.time_to_ready_months}mo to ready</span>
          </div>
          <Progress value={data.probability_0_100} className="h-2 mt-1" />
        </div>
        {data.top_gaps?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Top gaps</p>
            <ul className="mt-1 space-y-1 text-sm">
              {data.top_gaps.slice(0, 3).map((gap) => (
                <li key={gap} className="flex items-center justify-between">
                  <span>{gap}</span>
                  <Link href="/dashboard/skills" className="text-xs text-primary underline">Improve →</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/credential">See credential →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
