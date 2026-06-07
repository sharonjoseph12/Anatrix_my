"use client";

// T092 — Analytics: monthly search credit balance + Antarix-sourced hires funnel.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function RecruiterAnalytics() {
  const [credit, setCredit] = useState<{ used: number; remaining: number; reset_at: string } | null>(null);
  const [funnel, setFunnel] = useState<{ sourced: number; total: number } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const c = await supabase.functions.invoke("recruiter-credit", { body: {} });
      if (c.data) setCredit(c.data as { used: number; remaining: number; reset_at: string });
      const f = await supabase.functions.invoke("recruiter-funnel", { body: {} });
      if (f.data) setFunnel(f.data as { sourced: number; total: number });
    })();
  }, []);

  return (
    <div className="space-y-4">
      {credit && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly search credits</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{credit.remaining}</p>
            <p className="text-xs text-muted-foreground">used {credit.used} of monthly cap</p>
            <Progress value={(credit.used / (credit.used + credit.remaining)) * 100} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">resets {new Date(credit.reset_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      )}
      {funnel && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Antarix-sourced hires</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{funnel.sourced}</p>
            <p className="text-xs text-muted-foreground">of {funnel.total} total hires this quarter</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <RecruiterAnalytics />
    </div>
  );
}
