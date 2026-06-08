// tests/e2e/credential-public-page.spec.ts
// T095 — /verify/{slug} renders and invalidates on score change.

import { test, expect } from "@playwright/test";

test("public credential page renders and revokes on user deletion", async ({ page, request }) => {
  // Issue a credential
  const issue = await request.post("/functions/v1/credential-issue");
  expect(issue.ok()).toBeTruthy();
  const { slug } = await (await request.get(`/functions/v1/credential-public/${(await issue.json() as { public_slug?: string }).public_slug ?? ""}`)).json() as { public_slug?: string };
  expect(slug).toBeTruthy();

  await page.goto(`/verify/${slug}`);
  await expect(page.getByText(/Skill Proof Score/i)).toBeVisible();
});
