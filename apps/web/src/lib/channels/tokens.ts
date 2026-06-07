// apps/web/src/lib/channels/tokens.ts
// T037/T042 — HMAC-SHA256 signed one-time tokens for channel OAuth flows.
// Used as:
//   - Discord OAuth `state` param (10 min TTL)
//   - Telegram /start <token> deep link (10 min TTL)
//
// Format: `${base64url(payloadJson)}.${base64url(hmacSig)}`
//   payload: { uid, ch, pr, exp, jti }  (user, channel, purpose, exp, random id)
//
// Implementation note: uses node:crypto so this module is Node-runtime only.
// Routes that import it (api/channels/connect, callback, etc.) are Node by
// default. Do NOT import from edge-runtime code.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ChannelTokenPurpose = "discord-oauth-state" | "telegram-start" | "verify-ack";

export type ChannelToken = {
  uid: string;
  ch: "discord" | "telegram";
  pr: ChannelTokenPurpose;
  exp: number;
  jti: string;
};

const TTL_SECONDS = 10 * 60;

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function getKey(): string {
  const k = process.env.CHANNEL_TOKEN_SIGNING_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("CHANNEL_TOKEN_SIGNING_KEY is not set");
  return k;
}

export function signChannelToken(input: {
  userId: string;
  channel: "discord" | "telegram";
  purpose: ChannelTokenPurpose;
  ttlSeconds?: number;
}): string {
  const payload: ChannelToken = {
    uid: input.userId,
    ch: input.channel,
    pr: input.purpose,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? TTL_SECONDS),
    jti: randomBytes(12).toString("hex"),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", getKey()).update(body).digest());
  return `${body}.${sig}`;
}

export type VerifyResult =
  | { ok: true; token: ChannelToken }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export function verifyChannelToken(raw: string): VerifyResult {
  const parts = raw.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const body = parts[0] ?? "";
  const sig = parts[1] ?? "";
  if (!body || !sig) return { ok: false, reason: "malformed" };
  const expected = createHmac("sha256", getKey()).update(body).digest();
  const provided = b64urlDecode(sig);
  if (provided.length !== expected.length) return { ok: false, reason: "bad-signature" };
  if (!timingSafeEqual(provided, expected)) return { ok: false, reason: "bad-signature" };
  let payload: ChannelToken;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, token: payload };
}

export const USED_TOKEN_PREFIX = "channel_token_jti:";
