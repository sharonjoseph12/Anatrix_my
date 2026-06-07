"use client";

import { cn } from "@/lib/utils";

export interface PeakWindow {
  startHour: number;
  endHour: number;
  multiplier: number;
  confidence: number;
}

function fmtHour(h: number): string {
  const v = h % 24;
  const ampm = v < 12 ? "a" : "p";
  const display = v % 12 === 0 ? 12 : v % 12;
  return `${display}${ampm}`;
}

export function PeakWindowClock({
  window,
  intensity,
  className,
}: {
  window: PeakWindow;
  /** Per-hour relative intensity 0-1 for the heat ring. */
  intensity: number[];
  className?: string;
}) {
  const cx = 100;
  const cy = 100;
  const r = 80;
  const strokeWidth = 14;
  const innerR = r - strokeWidth;

  const isInWindow = (h: number): boolean => {
    const start = window.startHour;
    const end = (start + 4) % 24;
    if (start < end) return h >= start && h < end;
    return h >= start || h < end;
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox="0 0 200 200" className="h-56 w-56" aria-label="Peak focus window">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {intensity.map((value, hour) => {
          const slice = (Math.PI * 2) / 24;
          const startAngle = -Math.PI / 2 + hour * slice;
          const endAngle = startAngle + slice;
          const outerR = r;
          const x1 = cx + outerR * Math.cos(startAngle);
          const y1 = cy + outerR * Math.sin(startAngle);
          const x2 = cx + outerR * Math.cos(endAngle);
          const y2 = cy + outerR * Math.sin(endAngle);
          const ix1 = cx + innerR * Math.cos(startAngle);
          const iy1 = cy + innerR * Math.sin(startAngle);
          const ix2 = cx + innerR * Math.cos(endAngle);
          const iy2 = cy + innerR * Math.sin(endAngle);
          const largeArc = slice > Math.PI ? 1 : 0;
          const path = [
            `M ${x1} ${y1}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${ix2} ${iy2}`,
            `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
            "Z",
          ].join(" ");
          const inWindow = isInWindow(hour);
          const fill = inWindow
            ? `hsl(var(--primary) / ${0.25 + value * 0.6})`
            : `hsl(var(--muted) / ${0.4 + value * 0.4})`;
          return <path key={hour} d={path} fill={fill} stroke="hsl(var(--background))" strokeWidth="1" />;
        })}
        {/* Hour ticks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (-Math.PI / 2) + (i * Math.PI * 2) / 12;
          const tx = cx + (r + 12) * Math.cos(angle);
          const ty = cy + (r + 12) * Math.sin(angle);
          return (
            <text
              key={i}
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground text-[10px]"
            >
              {i === 0 ? 12 : i}
            </text>
          );
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-foreground text-2xl font-bold"
        >
          {window.multiplier.toFixed(2)}×
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          peak multiplier
        </text>
      </svg>
      <p className="mt-2 text-sm font-medium">
        {fmtHour(window.startHour)} – {fmtHour((window.startHour + 4) % 24)}
      </p>
      <p className="text-xs text-muted-foreground">
        Confidence: {Math.round(window.confidence * 100)}%
      </p>
    </div>
  );
}
