// tests/integration/webhook-signing.test.ts
// Unit tests for apps/web/src/lib/api/webhook-sign.ts
//
// Coverage (per task spec):
//   - Sign + verify roundtrip succeeds
//   - Tampered body → verify fails
//   - Tampered timestamp → verify fails
//   - Timestamp > toleranceSeconds old → verify fails
//   - Wrong secret → verify fails
//   - timingSafeEqual behaviour: identical-length wrong values still return false

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  signWebhookPayload,
  verifyWebhookSignature,
  renderSignatureHeader,
} from "@/lib/api/webhook-sign";

const SECRET = "whsec_test_super_secret_value";
const BODY = JSON.stringify({ event: "score.updated", data: { user_id: "u_1" } });

describe("webhook-sign", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sign + verify roundtrip succeeds", () => {
    const signed = signWebhookPayload(SECRET, BODY);
    const header = renderSignatureHeader(signed);
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signed = signWebhookPayload(SECRET, BODY);
    const header = renderSignatureHeader(signed);
    const tampered = BODY.replace("u_1", "u_2");
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: tampered, headerValue: header })).toBe(false);
  });

  it("rejects a tampered timestamp", () => {
    const signed = signWebhookPayload(SECRET, BODY);
    const header = `t=${signed.timestamp + 60},v1=${signed.signature}`;
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(false);
  });

  it("rejects a signature whose timestamp is beyond the tolerance window", () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const signed = signWebhookPayload(SECRET, BODY, tenMinutesAgo);
    const header = renderSignatureHeader(signed);
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(false);
  });

  it("accepts a signature just inside the tolerance window", () => {
    const fourMinutesAgo = Math.floor(Date.now() / 1000) - 240;
    const signed = signWebhookPayload(SECRET, BODY, fourMinutesAgo);
    const header = renderSignatureHeader(signed);
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(true);
  });

  it("rejects a signature produced with a different secret", () => {
    const signed = signWebhookPayload("whsec_other_secret", BODY);
    const header = renderSignatureHeader(signed);
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(false);
  });

  it("rejects an identically-sized but wrong hex signature", () => {
    const signed = signWebhookPayload(SECRET, BODY);
    const tamperedHex = signed.signature.split("").map((c) => (c === "0" ? "1" : "0")).join("");
    const header = `t=${signed.timestamp},v1=${tamperedHex}`;
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(false);
  });

  it("rejects a header with a wrong length signature (timingSafeEqual guard)", () => {
    const signed = signWebhookPayload(SECRET, BODY);
    const truncated = signed.signature.slice(0, -2);
    const header = `t=${signed.timestamp},v1=${truncated}`;
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(false);
  });

  it("rejects a header missing the t= part", () => {
    const signed = signWebhookPayload(SECRET, BODY);
    const header = `v1=${signed.signature}`;
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(false);
  });

  it("rejects a header missing the v1= part", () => {
    const signed = signWebhookPayload(SECRET, BODY);
    const header = `t=${signed.timestamp}`;
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header })).toBe(false);
  });

  it("respects an explicit toleranceSeconds override", () => {
    const future = Math.floor(Date.now() / 1000) + 120;
    const signed = signWebhookPayload(SECRET, BODY, future);
    const header = renderSignatureHeader(signed);
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header, toleranceSeconds: 60 })).toBe(false);
    expect(verifyWebhookSignature({ secret: SECRET, rawBody: BODY, headerValue: header, toleranceSeconds: 300 })).toBe(true);
  });

  it("renderSignatureHeader produces the contract format", () => {
    const signed = signWebhookPayload(SECRET, BODY, 1_700_000_000);
    expect(renderSignatureHeader(signed)).toBe(`t=1700000000,v1=${signed.signature}`);
  });
});
