"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

type Row = {
  rank: number;
  student_id: string | null;
  display_name: string | null;
  score: number;
};

export function StudentLeaderboard({ hackathonId }: { hackathonId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hackathonId]);

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
        {!rows && !error && <div className="h-24 animate-pulse rounded bg-muted" />}
        {rows && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No graded submissions yet.</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y text-sm">
            {rows.slice(0, 20).map((r) => (
              <li key={r.rank} className="flex items-center justify-between py-2">
                <span>#{r.rank} · {r.display_name ?? "—"}</span>
                <span className="font-semibold tabular-nums">{r.score}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
