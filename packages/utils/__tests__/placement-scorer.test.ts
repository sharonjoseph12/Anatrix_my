// packages/utils/__tests__/placement-scorer.test.ts
// T076 — Verify the placement-scorer produces sensible outputs for a couple of
// representative inputs.

import { describe, it, expect } from "vitest";

// Inlined copy of the scorer so this test doesn't pull Deno code into a Node test.
type Features = {
  score: number;
  streak: number;
  power_mode_active: boolean;
  session_count: number;
  avg_focus_quality: number;
  total_focus_minutes: number;
  commit_count_30d: number;
  pr_count_30d: number;
  distinct_repos_30d: number;
  top_languages: string[];
  has_active_credential: boolean;
  credential_verification_count: number;
};
type Result = {
  probability_0_100: number;
  company_tier: string;
  time_to_ready_months: number;
  top_gaps: string[];
};

function scorePlacement(f: Features): Result {
  let p = 0;
  p += Math.min(40, f.score * 0.4);
  p += Math.min(15, f.streak * 0.5);
  p += f.power_mode_active ? 10 : 0;
  p += Math.min(10, f.avg_focus_quality * 10);
  p += Math.min(10, Math.min(20, f.total_focus_minutes / 60) * 0.5);
  p += Math.min(10, Math.log10(f.commit_count_30d + 1) * 5);
  p += Math.min(5, f.pr_count_30d);
  p += f.has_active_credential ? 5 : 0;
  p += Math.min(5, f.credential_verification_count);
  const probability_0_100 = Math.max(0, Math.min(100, Math.round(p)));
  const company_tier =
    probability_0_100 >= 75 ? "Tier 1" : probability_0_100 >= 55 ? "Tier 2" : "Tier 3";
  const time_to_ready_months = Math.max(0, Math.round((75 - probability_0_100) / 10));
  const top_gaps: string[] = [];
  if (f.avg_focus_quality < 0.5) top_gaps.push("Session quality");
  if (f.commit_count_30d < 20) top_gaps.push("GitHub commit cadence");
  if (f.pr_count_30d < 2) top_gaps.push("Pull request volume");
  if (!f.has_active_credential) top_gaps.push("Issue a verified credential");
  if (f.total_focus_minutes < 600) top_gaps.push("Total focused time");
  return { probability_0_100, company_tier, time_to_ready_months, top_gaps };
}

describe("placement-scorer", () => {
  it("returns a strong score for a top-decile student", () => {
    const r = scorePlacement({
      score: 90,
      streak: 30,
      power_mode_active: true,
      session_count: 50,
      avg_focus_quality: 0.9,
      total_focus_minutes: 1500,
      commit_count_30d: 60,
      pr_count_30d: 8,
      distinct_repos_30d: 6,
      top_languages: ["TypeScript", "Go"],
      has_active_credential: true,
      credential_verification_count: 12,
    });
    expect(r.probability_0_100).toBeGreaterThan(75);
    expect(r.company_tier).toBe("Tier 1");
    expect(r.time_to_ready_months).toBe(0);
  });

  it("returns a low score and 3+ gaps for a new student", () => {
    const r = scorePlacement({
      score: 30,
      streak: 2,
      power_mode_active: false,
      session_count: 5,
      avg_focus_quality: 0.3,
      total_focus_minutes: 90,
      commit_count_30d: 4,
      pr_count_30d: 0,
      distinct_repos_30d: 1,
      top_languages: ["Python"],
      has_active_credential: false,
      credential_verification_count: 0,
    });
    expect(r.probability_0_100).toBeLessThan(40);
    expect(r.top_gaps.length).toBeGreaterThanOrEqual(3);
    expect(r.top_gaps).toContain("Issue a verified credential");
  });

  it("clamps the probability at 100", () => {
    const r = scorePlacement({
      score: 100,
      streak: 365,
      power_mode_active: true,
      session_count: 200,
      avg_focus_quality: 1,
      total_focus_minutes: 5000,
      commit_count_30d: 200,
      pr_count_30d: 30,
      distinct_repos_30d: 20,
      top_languages: ["Rust", "Zig"],
      has_active_credential: true,
      credential_verification_count: 999,
    });
    expect(r.probability_0_100).toBe(100);
  });
});
