// supabase/functions/_shared/peak-window.ts
// T023 — pure: bucket events by local hour, return the most-productive window

export type HourBucket = { hour: number; weight: number };
export type PeakWindow = {
  startHour: number;
  endHour: number;
  multiplier: number;
  confidence: number;
};

export function computePeakWindow(
  events: Array<{ localHour: number; weight: number }>,
  minEvents = 10,
): PeakWindow | null {
  if (events.length < minEvents) return null;
  const buckets = new Map<number, number>();
  for (const e of events) {
    buckets.set(e.localHour, (buckets.get(e.localHour) ?? 0) + e.weight);
  }
  const sorted = Array.from(buckets.entries())
    .map(([hour, total]) => ({ hour, total }))
    .sort((a, b) => b.total - a.total);
  const top3 = sorted.slice(0, 3).map((s) => s.hour).sort((a, b) => a - b);
  if (top3.length === 0) return null;
  const startHour = top3[0];
  const endHour = (top3[top3.length - 1] + 1) % 24;
  const overall = sorted.reduce((acc, s) => acc + s.total, 0) / Math.max(1, sorted.length);
  const peakTotal = top3.reduce((acc, h) => acc + (buckets.get(h) ?? 0), 0) / top3.length;
  const multiplier = overall > 0 ? +(peakTotal / overall).toFixed(2) : 1;
  const confidence = Math.min(1, events.length / 50);
  return { startHour, endHour, multiplier, confidence };
}
