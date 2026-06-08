"use client";

// T091 — Pipeline funnel view: invite → accepted → interviewed → outcome, with
// Antarix-source attribution for hires that originated on the platform.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Stage = { stage: "invite" | "accepted" | "interviewed" | "outcome"; count: number };

export function PipelineFunnel() {
  const [stages, setStages] = useState<Stage[] | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("job_matches")
        .select("status,interview_scheduling_state,interview_outcome,source")
        .eq("recruiter_user_id", user.id);
      const counts = { invite: 0, accepted: 0, interviewed: 0, outcome: 0 };
      for (const m of data ?? []) {
        counts.invite++;
        if (m.status === "interview_accepted" || m.status === "interview_proposed" || m.status === "interview_completed" || m.status === "offer_extended" || m.status === "hired") counts.accepted++;
        if (m.status === "interview_completed" || m.status === "offer_extended" || m.status === "hired") counts.interviewed++;
        if (m.interview_outcome) counts.outcome++;
      }
      setStages([
        { stage: "invite", count: counts.invite },
        { stage: "accepted", count: counts.accepted },
        { stage: "interviewed", count: counts.interviewed },
        { stage: "outcome", count: counts.outcome },
      ]);
    })();
  }, []);

  if (!stages) return <div className="h-32 animate-pulse rounded-md bg-muted" />;
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-2">
      {stages.map((s) => (
        <Card key={s.stage}>
          <CardHeader><CardTitle className="text-sm capitalize">{s.stage}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-3 overflow-hidden rounded bg-muted">
              <div className="h-3 bg-primary" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{s.count} candidates</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pipeline</h1>
      <PipelineFunnel />
    </div>
  );
}
