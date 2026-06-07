"use client";

// T090 — Candidate results: skill proof, match score, one-click invite, schedule (disabled until accepted).

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Send, Calendar } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Result = {
  user_id: string;
  name: string;
  score: number;
  match_score: number;
  top_skills: string[];
  verified_activity_summary: string;
  power_mode_active: boolean;
};

export function RecruiterResultsView() {
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("recruiter:results");
    if (stored) setResults(JSON.parse(stored) as Result[]);
  }, []);

  if (!results) return <p className="text-sm text-muted-foreground">Run a search to see candidates here.</p>;
  return (
    <div className="space-y-2">
      {results.map((r) => (
        <Card key={r.user_id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {r.name}
              {r.power_mode_active && <Zap className="h-3 w-3 text-amber-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">{r.verified_activity_summary}</p>
            <div className="flex flex-wrap gap-1">
              {r.top_skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Score {r.score} · match {r.match_score}%</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => invite(r.user_id)}>
                  <Send className="h-3 w-3" /> One-Click Invite
                </Button>
                <Button size="sm" variant="ghost" disabled>
                  <Calendar className="h-3 w-3" /> Schedule (after acceptance)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function invite(studentId: string) {
  const supabase = createSupabaseBrowserClient();
  await supabase.functions.invoke("recruiter-invite", { body: { student_user_id: studentId } });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Search results</h1>
      <RecruiterResultsView />
    </div>
  );
}
