import { describe, expect, it } from "vitest";

import {
  divergence,
  extractCadence,
  isDivergenceSignalActive,
  type TypingCadence,
} from "../../apps/web/src/lib/collab/typing-divergence";

describe("collab typing divergence", () => {
  it("keeps legitimate pair-programming below the signal threshold", () => {
    const driver: TypingCadence = { user_id: "a", keys_per_sec: 2.7, commits_in_window: 3 };
    const navigator: TypingCadence = { user_id: "b", keys_per_sec: 2.2, commits_in_window: 2 };

    const score = divergence(driver, navigator);

    expect(score).toBeLessThan(0.2);
    expect(isDivergenceSignalActive(score)).toBe(false);
  });

  it("flags suspected ghost-writing when one user is inactive and the other commits", () => {
    const requester: TypingCadence = { user_id: "a", keys_per_sec: 0.1, commits_in_window: 0 };
    const activeAuthor: TypingCadence = { user_id: "b", keys_per_sec: 4.5, commits_in_window: 7 };

    const score = divergence(requester, activeAuthor);

    expect(score).toBeGreaterThanOrEqual(0.65);
    expect(isDivergenceSignalActive(score)).toBe(true);
  });

  it("does not flag low-activity windows without commit concentration", () => {
    const requester: TypingCadence = { user_id: "a", keys_per_sec: 0.05, commits_in_window: 0 };
    const teammate: TypingCadence = { user_id: "b", keys_per_sec: 0.2, commits_in_window: 0 };

    const score = divergence(requester, teammate);

    expect(score).toBe(0);
    expect(isDivergenceSignalActive(score)).toBe(false);
  });

  it("extracts cadence from collab events inside the active window", () => {
    const events = [
      { user_id: "a", event_type: "typing", created_at: 1_000, payload_json: { keys_pressed: 90 } },
      { user_id: "a", event_type: "code_commit", created_at: 2_000 },
      { user_id: "a", event_type: "typing", created_at: 70_000, payload_json: { keys_pressed: 300 } },
    ];

    expect(extractCadence(events, "a", 0, 60_000)).toEqual({
      user_id: "a",
      keys_per_sec: 1.5,
      commits_in_window: 1,
    });
  });
});
