"use client";

import { Lightbulb, TrendingUp, Repeat2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type InsightType = "peak_window" | "workflow_pattern" | "skill_detection" | "productivity_trend" | "burnout_risk" | "category_success";

const ICONS: Record<InsightType, React.ComponentType<{ className?: string }>> = {
  peak_window: Sparkles,
  workflow_pattern: Repeat2,
  skill_detection: TrendingUp,
  productivity_trend: TrendingUp,
  burnout_risk: Lightbulb,
  category_success: Sparkles,
};

const TONE: Record<InsightType, string> = {
  peak_window: "text-violet-500",
  workflow_pattern: "text-sky-500",
  skill_detection: "text-emerald-500",
  productivity_trend: "text-amber-500",
  burnout_risk: "text-rose-500",
  category_success: "text-emerald-500",
};

export interface InsightCardProps {
  id: string;
  type: InsightType;
  title: string;
  description: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  confidence: number | null;
  dataPoints: number;
  recommendedAction: string | null;
  onValidate?: (id: string) => void;
  validating?: boolean;
}

export function InsightCard(props: InsightCardProps) {
  const Icon = ICONS[props.type] ?? Lightbulb;
  const confidencePct = props.confidence != null
    ? Math.round(props.confidence * 100)
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className={cn("h-4 w-4", TONE[props.type])} />
              {props.title}
            </CardTitle>
            {props.description && (
              <CardDescription>{props.description}</CardDescription>
            )}
          </div>
          {props.metricValue != null && (
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold">
                {props.metricValue}
                {props.metricUnit && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {props.metricUnit}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {props.recommendedAction && (
          <p className="text-sm">
            <span className="font-medium">Try:</span> {props.recommendedAction}
          </p>
        )}
        {confidencePct != null && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span>
                {confidencePct}% · {props.dataPoints} data points
              </span>
            </div>
            <Progress value={confidencePct} />
          </div>
        )}
      </CardContent>
      {props.onValidate && (
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onValidate?.(props.id)}
            disabled={props.validating}
          >
            {props.validating ? "Validating…" : "Validate this week"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
