// tests/e2e/privacy-opt-out.spec.ts
// T095 — Opted-out students never appear in recruiter search or result counts.

import { test, expect } from "@playwright/test";

test("opted-out student does not appear in recruiter search", async ({ browser, request }) => {
  // Create two students: opted-in and opted-out (helper endpoints assumed)
  const a = await request.post("/test-helpers/student", { data: { opted_in: true } });
  const b = await request.post("/test-helpers/student", { data: { opted_in: false } });
  const aId = (await a.json() as { user_id: string }).user_id;
  const bId = (await b.json() as { user_id: string }).user_id;

  // Recruiter searches for both
  const ctx = await browser.newContext({ storageState: "playwright/.auth/recruiter.json" });
  const api = await ctx.request;
  const r = await api.post("/functions/v1/recruiter-search", {
    data: { skills: [], min_score: 0, batch_years: [], location: "", power_mode_only: false },
  });
  const { results } = await r.json() as { results: Array<{ user_id: string }> };
  const ids = results.map((x) => x.user_id);
  expect(ids).toContain(aId);
  expect(ids).not.toContain(bId);
});
