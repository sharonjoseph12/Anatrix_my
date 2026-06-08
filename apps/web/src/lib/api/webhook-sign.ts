// apps/web/src/lib/api/webhook-sign.ts
// HMAC-SHA256 signing & verification for outbound webhook deliveries.
//
// Spec: specs/004-eleven-of-ten/contracts/api.md §"Webhook delivery contract"
//
//   signed_payload = `${timestamp}.${rawBody}`
//   signature      = hex(hmac_sha256(secret, signed_payload))
//   header_value   = `t=<unix-seconds>,v1=<hex-hmac-sha256>`
//
// Replay protection: verification rejects signatures whose timestamp is
// outside the configured `toleranceSeconds` window (default 5 minutes).
// Constant-time comparison via `crypto.timingSafeEqual` prevents signature
// length / byte-value side-channel leakage.
//
// All functions are pure (no network, no DB), so they are safe to call from
// both Node and Edge runtimes.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;
const SIGNATURE_VERSION = "v1";
const HEADER_PREFIX = "t=";

function hexToBuffer(hex: string): Buffer | null {
  if (hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

export interface SignedPayload {
  timestamp: number;
  signature: string;
  signedPayload: string;
}

export function signWebhookPayload(
  secret: string,
  rawBody: string,
  timestamp?: number,
): SignedPayload {
  const ts = typeof timestamp === "number" && Number.isFinite(timestamp)
    ? Math.floor(timestamp)
    : Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${rawBody}`;
  const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return { timestamp: ts, signature, signedPayload };
}

export interface SignatureVerificationOpts {
  secret: string;
  rawBody: string;
  headerValue: string;
  toleranceSeconds?: number;
}

interface ParsedHeader {
  timestamp: number | null;
  signature: string | null;
}

function parseHeader(headerValue: string): ParsedHeader {
  const out: ParsedHeader = { timestamp: null, signature: null };
  if (!headerValue) return out;
  for (const part of headerValue.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key === "t") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) out.timestamp = Math.floor(n);
    } else if (key === SIGNATURE_VERSION) {
      out.signature = value;
    }
  }
  return out;
}

export function verifyWebhookSignature(opts: SignatureVerificationOpts): boolean {
  const tolerance = typeof opts.toleranceSeconds === "number" && opts.toleranceSeconds >= 0
    ? Math.floor(opts.toleranceSeconds)
    : DEFAULT_TOLERANCE_SECONDS;

  const { timestamp, signature } = parseHeader(opts.headerValue);
  if (timestamp === null || !signature) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const expected = createHmac("sha256", opts.secret)
    .update(`${timestamp}.${opts.rawBody}`)
    .digest();

  const provided = hexToBuffer(signature);
  if (!provided) return false;
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export function renderSignatureHeader(signed: SignedPayload): string {
  return `${HEADER_PREFIX}${signed.timestamp},${SIGNATURE_VERSION}=${signed.signature}`;
}
