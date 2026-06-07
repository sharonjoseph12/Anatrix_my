// tests/e2e/ai-coach-whatsapp.spec.ts
// T095 — Nudge delivery + interactive commands.

import { test, expect } from "@playwright/test";

test("WhatsApp nudge delivery + START / DONE round-trip", async ({ page, request }) => {
  // Connect WhatsApp
  const connect = await request.post("/functions/v1/whatsapp-connect");
  expect(connect.ok()).toBeTruthy();
  const { deep_link } = await connect.json() as { deep_link: string };
  expect(deep_link).toMatch(/^https:\/\/wa\.me\//);

  // Trigger a daily morning nudge (manually)
  const trigger = await request.post("/functions/v1/nudge-trigger");
  expect(trigger.ok()).toBeTruthy();

  // Inbox shows the delivered nudge
  await page.goto("/ai-coach");
  await expect(page.getByText(/daily morning/i)).toBeVisible({ timeout: 60_000 });

  // Reply with STATS — gets queued
  await page.getByPlaceholder(/reply with a command/i).fill("STATS");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText("STATS")).toBeVisible();
});
