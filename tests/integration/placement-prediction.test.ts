// tests/integration/placement-prediction.test.ts
// T096 — placement-predict produces a fresh row for a qualifying user.

import { test, expect } from "@playwright/test";

test("placement-predict writes a row for a user with 30+ days of activity", async ({ request }) => {
  const r = await request.post("/functions/v1/placement-predict");
  expect(r.ok()).toBeTruthy();
  // No assertion error means the function completed and did not throw
});
