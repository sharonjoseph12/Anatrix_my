// apps/web/src/lib/biometrics/oura-client.ts
// Spec: specs/006-deep-signal-capture/spec.md FR-BIO-001..007
//   data-model.md lines 211-238
// Oura v2 OAuth (PKCE) + daily_sleep fetch. 1 req/s; 429 → parse Retry-After, wait, retry once.

import { createHash, randomBytes } from "node:crypto";
import type { OuraDailySummary } from "@antarix/types/biometrics";

export const OURA_OAUTH_SCOPES = ["daily", "personal", "heartrate"] as const;

const DEFAULT_API_BASE = "https://api.ouraring.com";

export class OuraApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Oura API error ${status}`);
    this.name = "OuraApiError";
    this.status = status;
    this.body = body;
  }
}

export interface OuraTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export interface OuraClientOpts {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiBase?: string;
}

export interface PkceState {
  state: string;
  code_verifier: string;
  code_challenge: string;
}

interface OuraRawDailySleep {
  id?: string;
  day?: string;
  score?: number | null;
  average_hrv?: number | null;
  average_heart_rate?: number | null;
  lowest_heart_rate?: number | null;
  [k: string]: unknown;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseRetryAfterMs(headerValue: string | null): number {
  if (!headerValue) return 1000;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const httpDate = Date.parse(headerValue);
  if (Number.isFinite(httpDate)) {
    return Math.max(0, httpDate - Date.now());
  }
  return 1000;
}

async function readJsonSafely<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function generatePkceState(): PkceState {
  const state = randomBytes(32).toString("hex");
  const code_verifier = b64url(randomBytes(64));
  const code_challenge = b64url(createHash("sha256").update(code_verifier).digest());
  return { state, code_verifier, code_challenge };
}

export class OuraClient {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly apiBase: string;

  constructor(opts: OuraClientOpts) {
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.redirectUri = opts.redirectUri;
    this.apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<OuraTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });
    return this.tokenRequest(body);
  }

  async refresh(refreshToken: string): Promise<OuraTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });
    return this.tokenRequest(body);
  }

  async fetchDailySummary(
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<OuraDailySummary[]> {
    const qs = `start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    const url = `${this.apiBase}/v2/usercollection/daily_sleep?${qs}`;
    const res = await this.fetchWithRetry(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    if (res.status < 200 || res.status >= 300) {
      const errBody = await readJsonSafely<unknown>(res);
      throw new OuraApiError(res.status, errBody, `Oura daily_sleep ${res.status}`);
    }
    const raw = await readJsonSafely<OuraRawDailySleep[] | OuraRawDailySleep>(res);
    const list: OuraRawDailySleep[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.map((d) => this.toSummary(d));
  }

  private toSummary(d: OuraRawDailySleep): OuraDailySummary {
    const out: OuraDailySummary = { day: d.day ?? "" };
    if (typeof d.score === "number") out.score = d.score;
    const hrv = d.average_hrv;
    if (typeof hrv === "number") out.hrv_avg = hrv;
    const rhr = d.lowest_heart_rate ?? d.average_heart_rate;
    if (typeof rhr === "number") out.resting_heart_rate = rhr;
    return out;
  }

  private async tokenRequest(body: URLSearchParams): Promise<OuraTokenResponse> {
    const url = `${this.apiBase}/oauth/token`;
    const res = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: body.toString(),
    });
    if (res.status < 200 || res.status >= 300) {
      const errBody = await readJsonSafely<unknown>(res);
      throw new OuraApiError(res.status, errBody, `Oura token endpoint ${res.status}`);
    }
    const data = await readJsonSafely<OuraTokenResponse>(res);
    if (!data?.access_token || !data?.refresh_token) {
      throw new OuraApiError(res.status, data, "Oura token response missing access_token or refresh_token");
    }
    return data;
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    const first = await fetch(url, init);
    if (first.status !== 429) return first;
    const waitMs = parseRetryAfterMs(first.headers.get("Retry-After"));
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    return fetch(url, init);
  }
}
