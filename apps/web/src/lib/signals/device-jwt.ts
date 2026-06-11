// apps/web/src/lib/signals/device-jwt.ts
// 11/10 — Device-scoped JWTs for IDE telemetry (FR-IDE-004: the client is
// never trusted). The extension receives a short-lived JWT that scopes it
// to a single device_id + student_id pair.
//
// v1 simplicity: HMAC-SHA256 with a shared secret derived from
// SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT. v2 (prod) moves to asymmetric keys
// so the extension can verify without knowing the server secret.
//
// Edge Functions that need to verify device JWTs import this file or
// re-implement the verify logic inline (marked with a MIRRORS comment).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEVICE_JWT_SECRET = process.env.SIGNAL_AUDIT_ACTOR_PSEUDONYM_SALT ?? 'change-me-dev-only';
const DEVICE_JWT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface DeviceJwtPayload {
  sub: string;       // student_id (uuid)
  device_id: string; // uuid
  iat: number;       // issued at (unix seconds)
  exp: number;       // expires at
}

export function signDeviceJwt(studentId: string, deviceId: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const payload: DeviceJwtPayload = {
    sub: studentId,
    device_id: deviceId,
    iat,
    exp: iat + DEVICE_JWT_TTL_SECONDS,
  };
  const b64Header = base64UrlEncode(JSON.stringify(header));
  const b64Payload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', DEVICE_JWT_SECRET)
    .update(`${b64Header}.${b64Payload}`)
    .digest()
    .toString('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

export function verifyDeviceJwt(token: string): DeviceJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [b64Header, b64Payload, signature] = parts;

  const expectedSig = createHmac('sha256', DEVICE_JWT_SECRET)
    .update(`${b64Header}.${b64Payload}`)
    .digest()
    .toString('base64url');
  if (!timingSafeEqual(Buffer.from(signature!, 'utf8'), Buffer.from(expectedSig, 'utf8'))) return null;

  try {
    const payload: DeviceJwtPayload = JSON.parse(Buffer.from(b64Payload!, 'base64url').toString('utf8'));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateDeviceId(): string {
  return randomBytes(16).toString('hex');
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}


