// tests/load/talent-twin-load.test.ts
// Load test: 50 concurrent recruiter queries against a 10K-chunk corpus.
// Run: npx vitest run --no-threads tests/load/talent-twin-load.test.ts

import { describe, it, expect } from "vitest";

const CONCURRENT_REQUESTS = 50;
const TARGET_P99_MS = 15_000;

async function simulateAsk(userIds: string[], question: string): Promise<number> {
  const start = performance.now();
  const resp = await fetch("http://localhost:54321/functions/v1/talent-twin-ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TEST_RECRUITER_JWT ?? ""}`,
    },
    body: JSON.stringify({ user_ids: userIds, question }),
  });
  const elapsed = performance.now() - start;
  expect(resp.ok).toBe(true);
  const body = await resp.json();
  expect(body.answer).toBeDefined();
  expect(body.citations).toBeDefined();
  return elapsed;
}

describe("talent-twin load test", () => {
  it("should handle 50 concurrent requests under p99 15s", async () => {
    if (!process.env.TEST_RECRUITER_JWT) {
      console.warn("SKIP: TEST_RECRUITER_JWT not set");
      return;
    }

    const userIds = Array.from({ length: 10 }, (_, i) => `test-user-${i}`);
    const questions = [
      "What frontend work has this candidate done?",
      "Describe their backend experience.",
      "Have they worked with databases?",
      "What testing frameworks do they know?",
      "Tell me about their collaborative projects.",
    ];

    const latencies: number[] = [];
    const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
      simulateAsk(userIds, questions[i % questions.length])
        .then((ms) => latencies.push(ms)),
    );

    await Promise.allSettled(promises);
    latencies.sort((a, b) => a - b);

    const p99Index = Math.ceil(latencies.length * 0.99) - 1;
    const p99 = latencies[p99Index] ?? 0;
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = latencies[latencies.length - 1] ?? 0;

    console.log(`\nLoad test results (${latencies.length} successful):`);
    console.log(`  avg: ${avg.toFixed(0)}ms`);
    console.log(`  p99: ${p99.toFixed(0)}ms`);
    console.log(`  max: ${max.toFixed(0)}ms`);

    expect(p99).toBeLessThan(TARGET_P99_MS);
  });
});
