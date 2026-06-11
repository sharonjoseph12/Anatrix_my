// packages/utils/__tests__/whatsapp-cost-guard.test.ts

import { describe, it, expect } from "vitest";
import { shouldSendWhatsApp } from "../whatsapp-cost-guard";

describe("whatsapp cost guard", () => {
  it("allows sending when under the cap", () => {
    expect(shouldSendWhatsApp(5).allowed).toBe(true);
  });

  it("blocks when at or above the cap", () => {
    expect(shouldSendWhatsApp(20).allowed).toBe(false);
    expect(shouldSendWhatsApp(20).reason).toBe("weekly_cap");
    expect(shouldSendWhatsApp(25).allowed).toBe(false);
  });

  it("respects a custom cap", () => {
    expect(shouldSendWhatsApp(15, 10).allowed).toBe(false);
    expect(shouldSendWhatsApp(5, 10).allowed).toBe(true);
  });

  it("reports the current count and cap in the result", () => {
    const r = shouldSendWhatsApp(7, 10);
    expect(r.current).toBe(7);
    expect(r.cap).toBe(10);
  });
});
