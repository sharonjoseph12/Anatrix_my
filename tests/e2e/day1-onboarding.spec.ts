// tests/e2e/day1-onboarding.spec.ts
// T095 — Day-1 value: signup → real insights in < 3 min (no 7-day wait).

import { test, expect } from "@playwright/test";

test("Day-1 value: real insights surface within 3 minutes of GitHub OAuth", async ({ page }) => {
  test.setTimeout(240_000); // 4 minutes
  const t0 = Date.now();
  await page.goto("/");
  await page.getByRole("button", { name: /sign up|continue with github/i }).click();
  // Assume a stub OAuth flow that returns to /auth/callback?code=…
  await page.waitForURL(/auth\/callback/);
  await page.waitForURL(/dashboard/);
  // Insights must appear within 3 minutes
  await expect(page.getByTestId("day-one-insights")).toBeVisible({ timeout: 180_000 });
  // First score must be a number, not a "—"
  const score = await page.getByTestId("day-one-score").textContent();
  expect(Number(score)).toBeGreaterThan(0);
  expect(Date.now() - t0).toBeLessThan(240_000);
});
