// packages/utils/__tests__/suppress-nudge.test.ts
// Verifies the suppression rules used by nudge-dispatch and nudge-trigger.

import { describe, it, expect } from "vitest";
import { shouldSuppress, type NudgePrefs } from "../suppress-nudge";

const basePrefs: NudgePrefs = {
  pause_all: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  real_time_peak_nudges: true,
  streak_risk_nudges: true,
  whatsapp_channel: false,
  push_channel: true,
  dashboard_channel: true,
};

describe("shouldSuppress", () => {
  it("returns 'pause_all' when pause_all is true", () => {
    expect(
      shouldSuppress({
        prefs: { ...basePrefs, pause_all: true },
        type: "daily_morning",
        channel: "push",
        localNow: "12:00",
        localDate: "2026-06-08",
      }),
    ).toBe("pause_all");
  });

  it("returns 'type_disabled' when the type is disabled", () => {
    expect(
      shouldSuppress({
        prefs: { ...basePrefs, streak_risk_nudges: false },
        type: "streak_risk",
        channel: "push",
        localNow: "12:00",
        localDate: "2026-06-08",
      }),
    ).toBe("type_disabled");
  });

  it("returns 'exam_week' during an active exam window for real_time_peak", () => {
    expect(
      shouldSuppress({
        prefs: basePrefs,
        type: "real_time_peak",
        channel: "push",
        localNow: "15:00",
        localDate: "2026-06-08",
        examWindows: [{ start: "2026-06-01", end: "2026-06-15" }],
      }),
    ).toBe("exam_week");
  });

  it("returns 'channel_disabled' when whatsapp_channel is false for a WhatsApp nudge", () => {
    expect(
      shouldSuppress({
        prefs: { ...basePrefs, whatsapp_channel: false },
        type: "daily_morning",
        channel: "whatsapp",
        localNow: "08:00",
        localDate: "2026-06-08",
      }),
    ).toBe("channel_disabled");
  });

  it("returns 'quiet_hours' when localNow is in a wrap-around window", () => {
    expect(
      shouldSuppress({
        prefs: basePrefs,
        type: "daily_morning",
        channel: "push",
        localNow: "23:00",
        localDate: "2026-06-08",
      }),
    ).toBe("quiet_hours");
  });

  it("returns null when all gates are clear", () => {
    expect(
      shouldSuppress({
        prefs: { ...basePrefs, whatsapp_channel: true },
        type: "daily_morning",
        channel: "push",
        localNow: "08:00",
        localDate: "2026-06-08",
      }),
    ).toBeNull();
  });
});
