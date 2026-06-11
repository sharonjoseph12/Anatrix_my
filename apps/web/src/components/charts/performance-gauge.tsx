"use client";

import { cn } from "@/lib/utils";

export function PerformanceGauge({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const angle = pct * 360;
  const tier =
    pct >= 0.85 ? "Elite" : pct >= 0.70 ? "Proven" : pct >= 0.45 ? "Builder" : "Explorer";
  const tierColor =
    pct >= 0.85
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 0.70
        ? "text-violet-600 dark:text-violet-400"
        : pct >= 0.45
          ? "text-sky-600 dark:text-sky-400"
          : "text-muted-foreground";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        className="relative h-32 w-32 rounded-full"
        style={{
          background: `conic-gradient(hsl(var(--primary)) ${angle}deg, hsl(var(--muted)) ${angle}deg 360deg)`,
        }}
        aria-label={`${label ?? "Performance"}: ${value} of ${max}`}
      >
        <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-background">
          <span className="text-3xl font-bold">{value}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            / {max}
          </span>
        </div>
      </div>
      {label && <p className="mt-3 text-sm font-medium">{label}</p>}
      <p className={cn("text-xs font-semibold", tierColor)}>{tier}</p>
    </div>
  );
}
