import { redirect } from "next/navigation";
import { Flame, Clock, TrendingUp, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PeakWindowClock, type PeakWindow } from "@/components/charts/peak-window-clock";

type Category = "dsa" | "coding" | "project" | "learning" | "research";

interface SessionRow {
  started_at: string;
  duration_minutes: number;
  focus_score: number | null;
  focus_level: "high" | "medium" | "low";
  category: Category;
}

export default async function PeakSelfPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/peak-self");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("started_at,duration_minutes,focus_score,focus_level,category")
    .eq("user_id", user.id)
    .gte("started_at", since);

  const sessionRows = (sessions ?? []) as SessionRow[];
  const peak = computePeakFromRows(sessionRows);
  const intensity = computeHourIntensity(sessionRows);
  const focusByCategory = aggregateByCategory(sessionRows);
  const peakDay = computePeakDayBlueprint(peak.startHour, focusByCategory);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          Peak Self
        </h1>
        <p className="text-muted-foreground">
          Your highest-leverage 4-hour block over the last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Peak focus window</CardTitle>
            <CardDescription>
              {Math.round(peak.confidence * 100)}% confidence · {sessionRows.length} sessions analyzed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PeakWindowClock
              window={{
                startHour: peak.startHour,
                endHour: peak.endHour,
                multiplier: peak.multiplier,
                confidence: peak.confidence,
              }}
              intensity={intensity}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                Best metrics this window
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric
                icon={<Clock className="h-4 w-4" />}
                label="Avg focus"
                value={Math.round(peak.avgFocus * 100) + "%"}
              />
              <Metric
                icon={<TrendingUp className="h-4 w-4" />}
                label="Multiplier"
                value={peak.multiplier.toFixed(2) + "×"}
              />
              <Metric
                icon={<Clock className="h-4 w-4" />}
                label="Sessions"
                value={String(peak.sessionCount)}
              />
              <Metric
                icon={<Clock className="h-4 w-4" />}
                label="Hours"
                value={peak.totalHours.toFixed(1)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peak Day Blueprint</CardTitle>
              <CardDescription>
                Suggested order of activities during your {peak.startHourLabel}–{peak.endHourLabel} block.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {peakDay.map((step, i) => (
                  <li
                    key={`${step.category}-${i}`}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">
                        {step.category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.minutes} min · {step.label}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {step.startLabel}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function formatHour(hour: number): string {
  const h = hour % 24;
  const ampm = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${ampm}`;
}

function computePeakFromRows(sessions: SessionRow[]) {
  if (sessions.length === 0) {
    return {
      startHour: 9,
      endHour: 13,
      multiplier: 1,
      confidence: 0,
      avgFocus: 0,
      sessionCount: 0,
      totalHours: 0,
      startHourLabel: formatHour(9),
      endHourLabel: formatHour(13),
    };
  }

  const WINDOW = 4;
  const buckets = new Array(24).fill(0).map(() => ({ focus: 0, minutes: 0, count: 0 }));
  for (const s of sessions) {
    const h = new Date(s.started_at).getHours();
    const f = s.focus_score ?? ({ high: 0.9, medium: 0.6, low: 0.3 }[s.focus_level]);
    const weight = Math.max(1, s.duration_minutes);
    const b = buckets[h]!;
    b.focus += f * weight;
    b.minutes += weight;
    b.count += 1;
  }
  let bestStart = 0;
  let bestMean = -1;
  for (let start = 0; start < 24; start += 1) {
    let focus = 0;
    let minutes = 0;
    let count = 0;
    for (let i = 0; i < WINDOW; i += 1) {
      const b = buckets[(start + i) % 24]!;
      focus += b.focus;
      minutes += b.minutes;
      count += b.count;
    }
    const mean = minutes > 0 ? focus / minutes : 0;
    if (mean > bestMean) {
      bestMean = mean;
      bestStart = start;
    }
  }
  const totalFocus = buckets.reduce((s, b) => s + b.focus, 0);
  const totalMinutes = buckets.reduce((s, b) => s + b.minutes, 0);
  const overall = totalMinutes > 0 ? totalFocus / totalMinutes : 0.5;
  const multiplier = overall > 0 ? bestMean / overall : 1;

  let windowFocus = 0;
  let windowMinutes = 0;
  let windowCount = 0;
  for (let i = 0; i < WINDOW; i += 1) {
    const b = buckets[(bestStart + i) % 24]!;
    windowFocus += b.focus;
    windowMinutes += b.minutes;
    windowCount += b.count;
  }

  return {
    startHour: bestStart,
    endHour: (bestStart + WINDOW) % 24,
    multiplier: Math.round(multiplier * 100) / 100,
    confidence: Math.min(1, sessions.length / 21),
    avgFocus: windowMinutes > 0 ? windowFocus / windowMinutes : 0,
    sessionCount: windowCount,
    totalHours: Math.round((windowMinutes / 60) * 10) / 10,
    startHourLabel: formatHour(bestStart),
    endHourLabel: formatHour((bestStart + WINDOW) % 24),
  };
}

function computeHourIntensity(sessions: SessionRow[]): number[] {
  const buckets = new Array(24).fill(0);
  const totals = new Array(24).fill(0);
  for (const s of sessions) {
    const h = new Date(s.started_at).getHours();
    const f = s.focus_score ?? ({ high: 0.9, medium: 0.6, low: 0.3 }[s.focus_level]);
    const w = Math.max(1, s.duration_minutes);
    buckets[h] += f * w;
    totals[h] += w;
  }
  const max = Math.max(...buckets.map((b, i) => (totals[i] ? b / totals[i] : 0)), 0.01);
  return buckets.map((b, i) => (totals[i] ? b / totals[i] / max : 0));
}

function aggregateByCategory(sessions: SessionRow[]) {
  const map = new Map<Category, { focus: number; minutes: number; count: number }>();
  for (const s of sessions) {
    const f = s.focus_score ?? ({ high: 0.9, medium: 0.6, low: 0.3 }[s.focus_level]);
    const w = Math.max(1, s.duration_minutes);
    const e = map.get(s.category) ?? { focus: 0, minutes: 0, count: 0 };
    e.focus += f * w;
    e.minutes += w;
    e.count += 1;
    map.set(s.category, e);
  }
  return Array.from(map.entries()).map(([category, v]) => ({
    category,
    focus: v.minutes > 0 ? v.focus / v.minutes : 0,
    minutes: v.minutes,
    count: v.count,
  }));
}

function computePeakDayBlueprint(
  startHour: number,
  categoryStats: Array<{ category: Category; focus: number; minutes: number; count: number }>,
) {
  // Order: highest focus first, then alternate categories.
  const sorted = [...categoryStats].sort((a, b) => b.focus - a.focus);
  const picks = sorted.slice(0, 4);
  // Split the 4-hour window across the picked categories proportional to their
  // share of the user's focus-weighted time. If no data, give a default.
  const totalMinutes = picks.reduce((sum, p) => sum + p.minutes, 0) || 1;
  const WINDOW_MIN = 240;

  let cursor = startHour * 60;
  return picks.map((p, i) => {
    const share = (p.minutes / totalMinutes) * WINDOW_MIN;
    const minutes = Math.max(15, Math.round(share / 15) * 15);
    const startMin = cursor;
    const startLabel = formatHour(Math.floor(startMin / 60) % 24) + ":" + String(startMin % 60).padStart(2, "0");
    cursor += minutes;
    return {
      category: p.category,
      minutes,
      startLabel,
      label: p.focus >= 0.75 ? "high focus" : p.focus >= 0.5 ? "medium focus" : "low focus",
    };
  });
}
