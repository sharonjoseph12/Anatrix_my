// packages/utils/__tests__/leaderboard.test.ts
// T084 — Tie-breaker rules: score DESC, last_active_at DESC, user_id ASC.

import { describe, it, expect } from "vitest";
import { compareLeaderboard, rankLeaderboard } from "../leaderboard-tie-breakers";

describe("leaderboard tie-breakers", () => {
  const a = { user_id: "aaaa", score: 80, last_active_at: "2026-05-01T10:00:00Z" };
  const b = { user_id: "bbbb", score: 80, last_active_at: "2026-05-03T10:00:00Z" };
  const c = { user_id: "cccc", score: 80, last_active_at: "2026-05-03T10:00:00Z" };
  const d = { user_id: "dddd", score: 70, last_active_at: "2026-05-09T10:00:00Z" };

  it("sorts by score descending first", () => {
    const ranked = rankLeaderboard([d, a]);
    expect(ranked[0]?.user_id).toBe("aaaa");
    expect(ranked[1]?.user_id).toBe("dddd");
  });

  it("breaks ties on last_active_at descending", () => {
    const ranked = rankLeaderboard([a, b]);
    expect(ranked[0]?.user_id).toBe("bbbb");
    expect(ranked[1]?.user_id).toBe("aaaa");
  });

  it("breaks remaining ties on user_id ascending", () => {
    const ranked = rankLeaderboard([c, b]);
    expect(ranked[0]?.user_id).toBe("bbbb");
    expect(ranked[1]?.user_id).toBe("cccc");
  });

  it("assigns sequential ranks", () => {
    const ranked = rankLeaderboard([a, b, c, d]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("compareLeaderboard returns 0 for full ties", () => {
    const t = { user_id: "zzz", score: 50, last_active_at: "2026-01-01T00:00:00Z" };
    expect(compareLeaderboard(t, { ...t })).toBe(0);
  });
});
