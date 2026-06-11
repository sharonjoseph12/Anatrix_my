// Workflow pattern detection
// Finds the most-successful ordered sequence of session categories within a
// single day. A "successful" day is one where average focus_score exceeds the
// user's median — i.e. days where the ordering clearly worked.
//
// Output: the pattern string ("dsa → project → learning"), the share of
// successful days that follow it, and a confidence score.

export type WorkflowCategory = "dsa" | "coding" | "project" | "learning" | "research";

export interface WorkflowSession {
  started_at: string;
  category: WorkflowCategory;
  focus_score: number | null;
  focus_level: "high" | "medium" | "low";
}

export interface WorkflowPatternResult {
  pattern: WorkflowCategory[]; // canonicalized order, deduped consecutive
  successRate: number;         // 0-1
  confidence: number;          // 0-1
  daysAnalyzed: number;
}

const FOCUS_FALLBACK = { high: 0.9, medium: 0.6, low: 0.3 } as const;
const MIN_DAYS = 5;

function effectiveFocus(s: WorkflowSession): number {
  return s.focus_score ?? FOCUS_FALLBACK[s.focus_level];
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function canonicalize(seq: WorkflowCategory[]): WorkflowCategory[] {
  const out: WorkflowCategory[] = [];
  for (const c of seq) {
    if (out[out.length - 1] !== c) out.push(c);
  }
  return out;
}

export function computeWorkflowPattern(sessions: WorkflowSession[]): WorkflowPatternResult {
  if (sessions.length === 0) {
    return { pattern: [], successRate: 0, confidence: 0, daysAnalyzed: 0 };
  }

  // 1. Group sessions by day and compute day-level focus
  const dayMap = new Map<string, { sessions: WorkflowSession[]; focusSum: number; weight: number }>();
  for (const s of sessions) {
    const key = dayKey(s.started_at);
    const w = Math.max(1, 1); // equal weight
    const f = effectiveFocus(s);
    const entry = dayMap.get(key) ?? { sessions: [], focusSum: 0, weight: 0 };
    entry.sessions.push(s);
    entry.focusSum += f * w;
    entry.weight += w;
    dayMap.set(key, entry);
  }

  const days = Array.from(dayMap.entries()).map(([key, v]) => ({
    key,
    avgFocus: v.weight > 0 ? v.focusSum / v.weight : 0,
    order: canonicalize(
      [...v.sessions]
        .sort((a, b) => a.started_at.localeCompare(b.started_at))
        .map((s) => s.category),
    ),
  }));

  if (days.length < MIN_DAYS) {
    return { pattern: [], successRate: 0, confidence: 0, daysAnalyzed: days.length };
  }

  // 2. Find median day focus, split successful vs all
  const sorted = days.map((d) => d.avgFocus).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const successfulDays = days.filter((d) => d.avgFocus >= median);

  // 3. Count pattern frequency in successful days
  const patternCounts = new Map<string, { pattern: WorkflowCategory[]; count: number }>();
  for (const d of successfulDays) {
    const key = d.order.join("→");
    const entry = patternCounts.get(key) ?? { pattern: d.order, count: 0 };
    entry.count += 1;
    patternCounts.set(key, entry);
  }

  let best: { pattern: WorkflowCategory[]; count: number } | null = null;
  for (const entry of patternCounts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }

  if (!best) {
    return { pattern: [], successRate: 0, confidence: 0, daysAnalyzed: days.length };
  }

  const successRate = successfulDays.length > 0 ? best.count / successfulDays.length : 0;
  const confidence = Math.min(1, days.length / 14);

  return {
    pattern: best.pattern,
    successRate: Math.round(successRate * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    daysAnalyzed: days.length,
  };
}
