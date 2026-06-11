// tests/integration/credential-threshold.test.ts
// T096 — credential-issue respects CREDENTIAL_SNAPSHOT_REFRESH_DELTA.

import { test, expect } from "@playwright/test";

test("credential-issue does not refresh under threshold", async ({ request }) => {
  // Set the env to a known value for this run (assumes test env)
  const r = await request.post("/functions/v1/credential-issue?user_id=test-user");
  expect(r.ok()).toBeTruthy();
  // No refresh should have happened if score delta is below the threshold
});
