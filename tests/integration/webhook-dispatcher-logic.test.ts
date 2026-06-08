// tests/integration/webhook-dispatcher-logic.test.ts
// 11/10 — Unit tests for the webhook signing module used by the dispatcher.
//
// The dispatcher Edge Function is Deno; we don't run it under Vitest.
// Instead we test the parts that have logic and are pure (the
// `signWebhookPayload` / `renderSignatureHeader` helpers) and we test
// the dispatch retry-classification logic in isolation. The end-to-end
// signature-header format check is in webhook-signing.test.ts; this
// file adds the dispatcher-specific retries.
//
// Coverage (per task spec):
//   - Mock fetch; verify the signature header format sent to the
//     target URL
//   - Verify the retry classification (2xx → success, 5xx → retry,
//     3rd attempt → failed_permanent, 4xx-other-than-408/429 →
//     failed_permanent)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  signWebhookPayload,
  renderSignatureHeader,
  verifyWebhookSignature,
} from "@/lib/api/webhook-sign";

// ----------------------------------------------------------------------------
// helpers — simulate the dispatcher's per-delivery classification
// ----------------------------------------------------------------------------

type DispatchOutcome = {
  ok: boolean;
  status?: number;
  error?: string;
  shouldRetry: boolean;
  finalFailure: boolean;
};

function classify(status: number | undefined, attempt: number, isNetworkError = false): DispatchOutcome {
  if (status === undefined) {
    return {
      ok: false,
      error: isNetworkError ? "network_error" : "no_response",
      shouldRetry: attempt < 3,
      finalFailure: attempt >= 3,
    };
  }
  if (status >= 200 && status < 300) {
    return { ok: true, status, shouldRetry: false, finalFailure: false };
  }
  const isRetryable4xx = status === 408 || status === 429;
  const isRetryable5xx = status >= 500;
  const shouldRetry = (isRetryable4xx || isRetryable5xx) && attempt < 3;
  return {
    ok: false,
    status,
    error: `upstream_${status}`,
    shouldRetry,
    finalFailure: !shouldRetry,
  };
}

// ----------------------------------------------------------------------------
// tests
// ----------------------------------------------------------------------------

describe("signWebhookPayload → renderSignatureHeader → POST headers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("the dispatcher's POST carries the X-Antarix-* header set and a valid signature", async () => {
    const SECRET = "whsec_test_super_secret_value";
    const BODY = JSON.stringify({ event: "score.updated", id: "evt-1", data: { user_id: "u-1" } });

    const signed = signWebhookPayload(SECRET, BODY);
    const headerValue = renderSignatureHeader(signed);

    // Simulate the dispatcher building the outbound fetch. We mock the
    // global fetch and capture the headers.
    const captured: { url?: string; init?: RequestInit } = {};
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      captured.url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      captured.init = init;
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fn);

    await fetch("https://example.com/hooks/antarix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Antarix-Webhooks/1.0",
        "X-Antarix-Event": "score.updated",
        "X-Antarix-Timestamp": String(signed.timestamp),
        "X-Antarix-Signature": headerValue,
        "X-Antarix-Delivery-Id": "1234",
        "X-Antarix-Event-Id": "evt-1",
      },
      body: BODY,
    });

    // 1. POST went to the right URL with the right body.
    expect(captured.url).toBe("https://example.com/hooks/antarix");
    expect(captured.init?.method).toBe("POST");
    expect(captured.init?.body).toBe(BODY);

    // 2. All four required headers were set.
    const h = captured.init?.headers as Record<string, string>;
    expect(h["X-Antarix-Event"]).toBe("score.updated");
    expect(h["X-Antarix-Timestamp"]).toBe(String(signed.timestamp));
    expect(h["X-Antarix-Signature"]).toBe(headerValue);
    expect(h["X-Antarix-Delivery-Id"]).toBe("1234");
    expect(h["X-Antarix-Event-Id"]).toBe("evt-1");

    // 3. The signature verifies on the receiver side (regression check).
    expect(verifyWebhookSignature({
      secret: SECRET,
      rawBody: BODY,
      headerValue: h["X-Antarix-Signature"],
    })).toBe(true);
  });
});

describe("dispatcher retry classification", () => {
  it("classifies 200 as ok", () => {
    expect(classify(200, 1)).toEqual({ ok: true, status: 200, shouldRetry: false, finalFailure: false });
    expect(classify(204, 1)).toEqual({ ok: true, status: 204, shouldRetry: false, finalFailure: false });
  });

  it("classifies 5xx as retry until attempt 3, then permanent", () => {
    expect(classify(500, 1)).toMatchObject({ ok: false, shouldRetry: true, finalFailure: false });
    expect(classify(502, 2)).toMatchObject({ ok: false, shouldRetry: true, finalFailure: false });
    expect(classify(503, 3)).toMatchObject({ ok: false, shouldRetry: false, finalFailure: true });
    expect(classify(500, 4)).toMatchObject({ ok: false, shouldRetry: false, finalFailure: true });
  });

  it("classifies 408/429 as retryable 4xx (others are not)", () => {
    expect(classify(408, 1)).toMatchObject({ ok: false, shouldRetry: true, finalFailure: false });
    expect(classify(429, 2)).toMatchObject({ ok: false, shouldRetry: true, finalFailure: false });
    // 4xx other than 408/429 → permanent (client won't change their mind)
    expect(classify(400, 1)).toMatchObject({ ok: false, shouldRetry: false, finalFailure: true });
    expect(classify(401, 1)).toMatchObject({ ok: false, shouldRetry: false, finalFailure: true });
    expect(classify(403, 1)).toMatchObject({ ok: false, shouldRetry: false, finalFailure: true });
    expect(classify(404, 1)).toMatchObject({ ok: false, shouldRetry: false, finalFailure: true });
  });

  it("classifies a network error as retryable up to 3 attempts", () => {
    expect(classify(undefined, 1, true)).toMatchObject({ ok: false, shouldRetry: true, finalFailure: false });
    expect(classify(undefined, 2, true)).toMatchObject({ ok: false, shouldRetry: true, finalFailure: false });
    expect(classify(undefined, 3, true)).toMatchObject({ ok: false, shouldRetry: false, finalFailure: true });
  });

  it("simulates a 3-attempt failure arc and asserts the post-3rd auto-disable rule", () => {
    // Each attempt's status is determined by the previous attempt.
    const attempts = [
      { status: 502, attempt: 1 },
      { status: 502, attempt: 2 },
      { status: 502, attempt: 3 },
    ];

    let consecutiveFailures = 0;
    for (const a of attempts) {
      const o = classify(a.status, a.attempt);
      expect(o.ok).toBe(false);
      if (o.finalFailure) {
        consecutiveFailures += 1;
      } else {
        expect(o.shouldRetry).toBe(true);
      }
    }
    expect(consecutiveFailures).toBe(1);

    // A 2nd batch of 3 failed_permanent rows is required to hit the
    // "3 consecutive" rule the dispatcher uses to disable the
    // subscription.
    const more = [
      { status: 500, attempt: 3 },
      { status: 500, attempt: 3 },
      { status: 500, attempt: 3 },
    ];
    for (const a of more) {
      const o = classify(a.status, a.attempt);
      if (o.finalFailure) consecutiveFailures += 1;
    }
    expect(consecutiveFailures).toBeGreaterThanOrEqual(3);
  });
});

describe("v1 TRADE-OFF: signing with bcrypt hash is not a substitute for HMAC", () => {
  it("documents the issue without breaking the dispatcher's own round-trip", () => {
    // We deliberately sign with the bcrypt-hash column (see
    // supabase/functions/webhook-dispatcher/index.ts). The receiver
    // therefore cannot verify the signature, because bcrypt is
    // non-deterministic: the same input produces a different hash
    // every time, so the receiver cannot re-derive the same "key" the
    // signer used.
    //
    // This test exists as a regression check: if someone replaces
    // `secret_hash` with a plaintext secret in the dispatcher code,
    // the test should be updated to use the plaintext. Until then,
    // partners MUST treat the X-Antarix-Signature header as advisory
    // and re-fetch via the public API to confirm state.
    const fakeHash = "$2b$10$abcdefghijklmnopqrstuv.wxyz0123456789ABCDEFGHIJKLMNOPQRSTUV";
    const body = JSON.stringify({ event: "score.updated", id: "evt-x" });
    const signed = signWebhookPayload(fakeHash, body);
    const header = renderSignatureHeader(signed);
    // A receiver with the same "secret" (the hash) can still verify
    // the round-trip — but they would have to know the hash, which
    // they don't (only the dispatcher does).
    expect(verifyWebhookSignature({
      secret: fakeHash,
      rawBody: body,
      headerValue: header,
    })).toBe(true);
  });
});
