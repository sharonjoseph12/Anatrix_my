// packages/utils/__tests__/timezone.test.ts

import { describe, it, expect } from "vitest";
import {
  toLocalIsoString,
  localHourOfDay,
  isInQuietHours,
  isExamWindow,
} from "../timezone";

describe("timezone helpers", () => {
  it("toLocalIsoString returns YYYY-MM-DDTHH:mm:ss in the given tz", () => {
    const s = toLocalIsoString("2026-06-08T05:30:00Z", { timeZone: "Asia/Kolkata" });
    expect(s).toBe("2026-06-08T11:00:00");
  });

  it("localHourOfDay returns the hour-of-day in the given tz", () => {
    expect(localHourOfDay("2026-06-08T05:30:00Z", "Asia/Kolkata")).toBe(11);
    expect(localHourOfDay("2026-06-08T22:00:00Z", "UTC")).toBe(22);
  });

  it("isInQuietHours handles a wrap-around window", () => {
    expect(isInQuietHours(23, "22:00", "07:00")).toBe(true);
    expect(isInQuietHours(2, "22:00", "07:00")).toBe(true);
    expect(isInQuietHours(10, "22:00", "07:00")).toBe(false);
  });

  it("isInQuietHours handles a normal window", () => {
    expect(isInQuietHours(13, "12:00", "14:00")).toBe(true);
    expect(isInQuietHours(11, "12:00", "14:00")).toBe(false);
  });

  it("isExamWindow returns true when the date is inside any window", () => {
    const w = [{ start_date: "2026-06-01", end_date: "2026-06-15" }];
    expect(isExamWindow("2026-06-08", w)).toBe(true);
    expect(isExamWindow("2026-06-20", w)).toBe(false);
  });
});
