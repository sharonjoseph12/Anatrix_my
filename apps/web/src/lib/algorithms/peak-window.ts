// Peak window analysis
// Buckets sessions by hour-of-day and finds the contiguous block with the
// highest average focus_score. Returns a productivity multiplier (best block
// / overall average) and a confidence score (sessions covered / 21 — three
// sessions per day for a week is a reasonable baseline).

export interface SessionForPeakWindow {
  started_at: string;
  duration_minutes: number;
  focus_score: number | null;
  focus_level: "high" | "medium" | "low";
}

export interface PeakWindowResult {
  startHour: number; // 0-23 inclusive
  endHour: number;   // 1-24 inclusive (end is exclusive)
  durationHours: number;
  multiplier: number;
  confidence: number; // 0-1
  totalSessions: number;
  totalHours: number;
}

const FOCUS_LEVEL_FALLBACK = { high: 0.9, medium: 0.6, low: 0.3 } as const;
const WINDOW_HOURS = 4;
const CONFIDENCE_TARGET_SESSIONS = 21;

function effectiveFocus(s: SessionForPeakWindow): number {
  if (s.focus_score != null) return s.focus_score;
  return FOCUS_LEVEL_FALLBACK[s.focus_level];
}

export function computePeakWindow(sessions: SessionForPeakWindow[]): PeakWindowResult {
  if (sessions.length === 0) {
    return {
      startHour: 9,
      endHour: 13,
      durationHours: 4,
      multiplier: 1,
      confidence: 0,
      totalSessions: 0,
      totalHours: 0,
    };
  }

  // 1. Aggregate weighted focus score by hour bucket
  const hourBuckets: Array<{ focus: number; minutes: number; count: number }> =
    Array.from({ length: 24 }, () => ({ focus: 0, minutes: 0, count: 0 }));
  for (const s of sessions) {
    const h = new Date(s.started_at).getHours();
    const f = effectiveFocus(s);
    const weight = Math.max(1, s.duration_minutes);
    const bucket = hourBuckets[h]!;
    bucket.focus += f * weight;
    bucket.minutes += weight;
    bucket.count += 1;
  }

  // 2. For each starting hour compute the rolling WINDOW_HOURS mean
  let bestStart = 0;
  let bestMean = -1;
  for (let start = 0; start < 24; start += 1) {
    let focus = 0;
    let minutes = 0;
    for (let i = 0; i < WINDOW_HOURS; i += 1) {
      const h = (start + i) % 24;
      const b = hourBuckets[h]!;
      focus += b.focus;
      minutes += b.minutes;
    }
    const mean = minutes > 0 ? focus / minutes : 0;
    if (mean > bestMean) {
      bestMean = mean;
      bestStart = start;
    }
  }

  // 3. Compute overall mean and multiplier
  const totalFocus = hourBuckets.reduce((sum, b) => sum + b.focus, 0);
  const totalMinutes = hourBuckets.reduce((sum, b) => sum + b.minutes, 0);
  const overallMean = totalMinutes > 0 ? totalFocus / totalMinutes : 0.5;
  const windowFocus = (() => {
    let focus = 0;
    let minutes = 0;
    for (let i = 0; i < WINDOW_HOURS; i += 1) {
      const h = (bestStart + i) % 24;
      const b = hourBuckets[h]!;
      focus += b.focus;
      minutes += b.minutes;
    }
    return minutes > 0 ? focus / minutes : 0;
  })();
  const multiplier = overallMean > 0 ? windowFocus / overallMean : 1;

  const totalSessions = sessions.length;
  const totalHours = totalMinutes / 60;
  const confidence = Math.min(1, totalSessions / CONFIDENCE_TARGET_SESSIONS);

  return {
    startHour: bestStart,
    endHour: (bestStart + WINDOW_HOURS) % 24,
    durationHours: WINDOW_HOURS,
    multiplier: Math.round(multiplier * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    totalSessions,
    totalHours: Math.round(totalHours * 10) / 10,
  };
}

export function formatHour(hour: number): string {
  const h = hour % 24;
  const ampm = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${ampm}`;
}
