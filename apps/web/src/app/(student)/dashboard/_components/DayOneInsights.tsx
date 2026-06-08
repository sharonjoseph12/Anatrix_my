"use client";

// T029 — Client component that renders the Day-1 insights card.
// Fetches /api/day-one-insights and shows real GitHub-derived data within
// 60 seconds of OAuth completion. Graceful empty state when nothing yet.

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, GitCommit, Sparkles } from "lucide-react";

type DayOne = {
  ready: boolean;
  commits: number;
  topLanguages: Array<{ name: string; pct: number }>;
  peakHours: number[];
  streakDays: number;
  firstPassScore: number;
  activeRepos: number;
};

const DEFAULT: DayOne = {
  ready: false,
  commits: 0,
  topLanguages: [],
  peakHours: [],
  streakDays: 0,
  firstPassScore: 0,
  activeRepos: 0,
};

export function DayOneInsights() {
  const [data, setData] = useState<DayOne>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const resp = await fetch("/api/day-one-insights", { cache: "no-store" });
        if (!resp.ok) return;
        const json = (await resp.json()) as DayOne;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    poll();
    const id = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading && !data.ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Reading your GitHub…
          </CardTitle>
          <CardDescription>Pulling your last 90 days of activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!data.ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Antarix</CardTitle>
          <CardDescription>Connect GitHub to see your verified skill proof.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Your Day-1 insights
        </CardTitle>
        <CardDescription>Real data from your GitHub. No waiting period.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={<GitCommit className="h-4 w-4" />} label="Commits (90d)" value={data.commits.toLocaleString()} />
          <Stat icon={<Flame className="h-4 w-4" />} label="Active streak" value={`${data.streakDays} days`} />
          <Stat icon={<Clock className="h-4 w-4" />} label="Peak hours" value={formatHours(data.peakHours)} />
          <Stat
            icon={<Sparkles className="h-4 w-4" />}
            label="Skill Proof"
            value={`${data.firstPassScore}/100`}
            highlight
          />
        </div>

        {data.topLanguages.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.topLanguages.map((l) => (
              <Badge key={l.name} variant="secondary">
                {l.name} · {l.pct}%
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon, label, value, highlight = false,
}: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-md border border-primary/30 bg-background p-3" : "p-3"}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function formatHours(hours: number[]): string {
  if (hours.length === 0) return "—";
  const first = hours[0] ?? 0;
  const last = hours[hours.length - 1] ?? 0;
  const fmt = (h: number) => `${h.toString().padStart(2, "0")}:00`;
  return `${fmt(first)}–${fmt((last + 1) % 24)}`;
}
