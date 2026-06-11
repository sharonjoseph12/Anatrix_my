"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, RefreshCw } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Row = {
  rank: number;
  student_id: string | null;
  display_name: string | null;
  score: number;
};

export function RecruiterLeaderboard({ hackathonId }: { hackathonId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/leaderboard`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { leaderboard?: Row[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load leaderboard");
        return;
      }
      setRows(data.leaderboard ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hackathonId]);

  async function fastTrack(studentId: string | null) {
    if (!studentId) return;
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Fire-and-forget: create a recruiter search/contact record. The
    // exact pipeline is recruiter-specific; for v1 we surface a
    // notification in the activity log.
    await supabase.from("activity_events").insert({
      user_id: user.id,
      actor_id: user.id,
      kind: "hackathon_fast_track",
      payload: { hackathon_id: hackathonId, candidate_id: studentId },
    });
    alert("Fast-track flag recorded. Open the candidate in the search tab to invite.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Leaderboard</span>
          <Button size="sm" variant="ghost" onClick={load} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!rows && !error && (
          <div className="h-24 animate-pulse rounded bg-muted" />
        )}
        {rows && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No graded submissions yet.</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.rank} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">#{r.rank} · {r.display_name ?? "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold tabular-nums">{r.score}</span>
                  {r.student_id && r.rank <= Math.max(1, Math.floor(rows.length * 0.05)) && (
                    <Button size="sm" variant="outline" onClick={() => fastTrack(r.student_id)}>
                      <Zap className="h-3 w-3" /> Fast-track
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
