// packages/utils/__tests__/interview-slot-generator.test.ts
// T094 — Slot-generation rules: peak-window-first, free-calendar-only,
// partial-result flag, target >=3 slots.

import { describe, it, expect } from "vitest";

type Slot = { start: string; end: string; peak_match: boolean };

function generateSlots(
  busy: Array<{ start: string; end: string }>,
  peak: { start: number; end: number },
  opts: { start: string; days?: number; slotMin?: number; target?: number; workStart?: number; workEnd?: number } = { start: new Date().toISOString() },
): { slots: Slot[]; partial: boolean } {
  const days = opts.days ?? 1;
  const slotMin = opts.slotMin ?? 45;
  const target = opts.target ?? 3;
  const workStart = opts.workStart ?? 9;
  const workEnd = opts.workEnd ?? 18;
  const out: Slot[] = [];
  for (let d = 0; d < days; d++) {
    for (let h = workStart; h < workEnd; h++) {
      for (const m of [0, 30]) {
        const s = new Date(opts.start);
        s.setUTCDate(s.getUTCDate() + d);
        s.setUTCHours(h, m, 0, 0);
        const e = new Date(s.getTime() + slotMin * 60 * 1000);
        const conflict = busy.some(
          (b) => new Date(b.start).getTime() < e.getTime() && new Date(b.end).getTime() > s.getTime(),
        );
        if (conflict) continue;
        const peakMatch = s.getUTCHours() >= peak.start && s.getUTCHours() < peak.end;
        out.push({ start: s.toISOString(), end: e.toISOString(), peak_match: peakMatch });
      }
    }
  }
  out.sort((a, b) => Number(b.peak_match) - Number(a.peak_match) || a.start.localeCompare(b.start));
  const chosen = out.slice(0, target);
  return { slots: chosen, partial: chosen.length < target };
}

describe("interview slot generator", () => {
  const noon = "2026-06-08T12:00:00.000Z";

  it("skips conflicting slots", () => {
    const r = generateSlots(
      [{ start: "2026-06-08T10:00:00.000Z", end: "2026-06-08T12:00:00.000Z" }],
      { start: 9, end: 12 },
      { start: noon, days: 1 },
    );
    for (const s of r.slots) {
      const startH = new Date(s.start).getUTCHours();
      expect(startH < 10 || startH >= 12).toBe(true);
    }
  });

  it("prefers peak-window slots", () => {
    const r = generateSlots([], { start: 10, end: 12 }, { start: noon, days: 1 });
    const first = r.slots[0];
    expect(first).toBeDefined();
    expect(first?.peak_match).toBe(true);
  });

  it("flags partial result when fewer than the target are free", () => {
    const heavyBusy: Array<{ start: string; end: string }> = [];
    for (let h = 9; h < 18; h++) {
      heavyBusy.push({
        start: `2026-06-08T${String(h).padStart(2, "0")}:00:00.000Z`,
        end: `2026-06-08T${String(h + 1).padStart(2, "0")}:30:00.000Z`,
      });
    }
    const r = generateSlots(heavyBusy, { start: 9, end: 18 }, { start: noon, days: 1, target: 3 });
    expect(r.partial).toBe(true);
  });

  it("caps at the target slot count", () => {
    const r = generateSlots([], { start: 9, end: 18 }, { start: noon, days: 1, target: 3 });
    expect(r.slots.length).toBeLessThanOrEqual(3);
  });
});
