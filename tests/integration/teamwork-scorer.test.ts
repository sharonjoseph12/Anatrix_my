import { describe, expect, it } from "vitest";

import { computeTeamworkScore, type TeamworkEvent, type TeamworkParticipant } from "../../apps/web/src/lib/algorithms/teamwork-scorer";

const participants: TeamworkParticipant[] = [
  { user_id: "a" },
  { user_id: "b" },
];

function commit(user_id: string, lines_added: number, active_seconds: number, files_touched: string[]): TeamworkEvent {
  return { user_id, event_type: "code_commit", payload_json: { lines_added, active_seconds, files_touched } };
}

describe("teamwork scorer", () => {
  it("scores a balanced session in the expected high band", () => {
    const scores = computeTeamworkScore([
      commit("a", 42, 900, ["api.ts", "test.ts"]),
      commit("b", 38, 780, ["api.ts", "readme.md"]),
      { user_id: "a", event_type: "conflict_resolved", payload_json: {} },
      { user_id: "b", event_type: "help_event", payload_json: { helper_id: "b", helpee_id: "a" } },
      { user_id: "a", event_type: "help_event", payload_json: { helper_id: "a", helpee_id: "b" } },
    ], participants);

    expect(scores.a?.score).toBeGreaterThanOrEqual(80);
    expect(scores.a?.subScores.turn_taking).toBeGreaterThanOrEqual(80);
    expect(scores.b?.score).toBe(scores.a?.score);
  });

  it("penalizes imbalanced contribution", () => {
    const scores = computeTeamworkScore([
      commit("a", 120, 1_500, ["main.ts", "api.ts", "db.ts"]),
      commit("b", 5, 80, ["readme.md"]),
    ], participants);

    expect(scores.a?.score).toBeLessThan(55);
    expect(scores.a?.breakdown.reasons).toContain("low_engagement: one participant active for < 10% of the busiest participant");
  });

  it("deducts for unresolved conflict-heavy sessions", () => {
    const scores = computeTeamworkScore([
      commit("a", 50, 700, ["main.ts"]),
      commit("b", 45, 680, ["main.ts"]),
      { user_id: "a", event_type: "conflict_unresolved", payload_json: {} },
      { user_id: "b", event_type: "conflict_unresolved", payload_json: {} },
      { user_id: "a", event_type: "conflict_unresolved", payload_json: {} },
    ], participants);

    expect(scores.a?.subScores.conflict_resolution).toBeLessThanOrEqual(10);
    expect(scores.a?.score).toBeLessThan(65);
  });

  it("rewards help-heavy sessions and nulls opted-out participants", () => {
    const scores = computeTeamworkScore([
      commit("a", 35, 500, ["main.ts"]),
      commit("b", 30, 470, ["main.ts"]),
      { user_id: "a", event_type: "help_event", payload_json: { helper_id: "a", helpee_id: "b" } },
      { user_id: "b", event_type: "help_event", payload_json: { helper_id: "b", helpee_id: "a" } },
      { user_id: "a", event_type: "help_event", payload_json: { helper_id: "a", helpee_id: "b" } },
    ], [{ user_id: "a" }, { user_id: "b" }, { user_id: "c", opt_out_teamwork: true }]);

    expect(scores.a?.subScores.help_events).toBeGreaterThanOrEqual(70);
    expect(scores.a?.score).toBeGreaterThanOrEqual(55);
    expect(scores.c).toBeNull();
  });
});
