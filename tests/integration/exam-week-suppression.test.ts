// tests/integration/exam-week-suppression.test.ts
// T096 — When a user has an exam_window, real-time-peak and streak-risk nudges
// are suppressed by shouldSuppress().

import { test, expect } from "@playwright/test";
import { shouldSuppress } from "../../supabase/functions/_shared/suppress-nudge.ts";

test("exam window suppresses real-time peak", () => {
  const r = shouldSuppress({
    prefs: { pause_all: false, quiet_start_local: "22:00", quiet_end_local: "07:00", real_time_peak: true },
    type: "real_time_peak",
    channel: "whatsapp",
    localNow: new Date("2026-06-08T15:00:00Z"),
    localDate: "2026-06-08",
    examWindows: [{ start_date: "2026-06-01", end_date: "2026-06-15" }],
  });
  expect(r).toBe("exam_window");
});
