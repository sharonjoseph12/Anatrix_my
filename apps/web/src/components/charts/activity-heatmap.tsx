"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type HeatmapDay = { date: string; count: number };

/**
 * 7-row × 53-col SVG activity heat map. 53 weeks covers 371 days (~1 year).
 * Pure SVG (no recharts dependency). Each cell is 11px × 11px with a 2px gap.
 */
export function ActivityHeatmap({
  data,
  weeks = 53,
  className,
}: {
  data: HeatmapDay[];
  weeks?: number;
  className?: string;
}) {
  const cells = useMemo(() => buildGrid(data, weeks), [data, weeks]);
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

  const cellSize = 11;
  const gap = 2;
  const rowWidth = cellSize + gap;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <svg
        width={weeks * rowWidth}
        height={7 * rowWidth}
        viewBox={`0 0 ${weeks * rowWidth} ${7 * rowWidth}`}
        className="block"
        role="img"
        aria-label="GitHub-style activity heat map"
      >
        {cells.map((cell) => {
          const ratio = cell.count / max;
          const opacity =
            cell.count === 0
              ? 0.08
              : ratio < 0.25
                ? 0.25
                : ratio < 0.5
                  ? 0.45
                  : ratio < 0.75
                    ? 0.7
                    : 1;
          return (
            <rect
              key={`${cell.col}-${cell.row}`}
              x={cell.col * rowWidth}
              y={cell.row * rowWidth}
              width={cellSize}
              height={cellSize}
              rx={2}
              className="fill-emerald-500"
              fillOpacity={opacity}
            >
              <title>
                {cell.date}: {cell.count}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function buildGrid(data: HeatmapDay[], weeks: number): Array<HeatmapDay & { col: number; row: number }> {
  // Build a date-indexed map; we only need date strings (YYYY-MM-DD)
  const map = new Map<string, number>();
  for (const d of data) map.set(d.date, d.count);

  // The grid ends today; column 0 starts 52 weeks ago.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Start from the most recent Sunday to align columns
  const dayOfWeek = today.getUTCDay();
  const endDate = new Date(today);
  endDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek));
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - weeks * 7 + 1);

  const out: Array<HeatmapDay & { col: number; row: number }> = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const d = new Date(startDate);
    d.setUTCDate(startDate.getUTCDate() + i);
    const col = Math.floor(i / 7);
    const row = i % 7;
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0, col, row });
  }
  return out;
}
