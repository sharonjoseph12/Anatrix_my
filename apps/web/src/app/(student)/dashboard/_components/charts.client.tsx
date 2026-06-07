"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const PerformanceGauge = dynamic(
  () => import("@/components/charts/performance-gauge").then((m) => m.PerformanceGauge),
  { ssr: false, loading: () => <Skeleton className="h-32 w-32 rounded-full" /> },
);

const WeeklyStatsBar = dynamic(
  () => import("@/components/charts/weekly-stats-bar").then((m) => m.WeeklyStatsBar),
  { ssr: false, loading: () => <Skeleton className="h-32" /> },
);

export { PerformanceGauge, WeeklyStatsBar };
