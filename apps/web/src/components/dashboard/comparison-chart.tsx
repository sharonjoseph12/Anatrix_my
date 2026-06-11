"use client";

import { Users, Plus, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ComparisonMetric {
  label: string;
  user: number;
  cohort: number;
  unit?: string;
  /** Higher is better. Defaults to true. */
  higherIsBetter?: boolean;
}

export function ComparisonChart({
  metrics,
}: {
  metrics: ComparisonMetric[];
}) {
  const data = metrics.map((m) => ({
    metric: m.label,
    You: m.user,
    Cohort: m.cohort,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius={90}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <PolarRadiusAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
        <Radar
          name="You"
          dataKey="You"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.35}
        />
        <Radar
          name="Cohort"
          dataKey="Cohort"
          stroke="hsl(var(--muted-foreground))"
          fill="hsl(var(--muted-foreground))"
          fillOpacity={0.15}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function AdvantageCell({
  delta,
  higherIsBetter = true,
  suffix = "",
}: {
  delta: number;
  higherIsBetter?: boolean;
  suffix?: string;
}) {
  const favorable = higherIsBetter ? delta > 0 : delta < 0;
  const Icon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const color = delta === 0
    ? "text-muted-foreground"
    : favorable
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", color)}>
      <Icon className="h-3 w-3" />
      {delta > 0 ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
}

export function CohortSummaryCard({
  name,
  memberCount,
  topCategory,
}: {
  name: string;
  memberCount: number;
  topCategory: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          {name}
        </CardTitle>
        <CardDescription>
          {memberCount} member{memberCount === 1 ? "" : "s"}
          {topCategory && (
            <>
              {" "}· top category: <Badge variant="outline" className="ml-1">{topCategory}</Badge>
            </>
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function EmptyCohortState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          No cohorts yet
        </CardTitle>
        <CardDescription>
          Create one to compare your metrics with peers — or join an existing cohort.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export { Plus };
