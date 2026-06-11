// apps/web/src/lib/biometrics/whoop-client.ts
// Spec: specs/006-deep-signal-capture/spec.md FR-BIO-001..007
//   data-model.md lines 211-238
// Whoop v1 OAuth (PKCE) + daily cycle fetch. Aggregates cycle + recovery + sleep + HRV
// into WhoopDailySummary rows. 1 req/s; 429 → parse Retry-After, wait, retry once.

import { createHash, randomBytes } from "node:crypto";
import type { WhoopDailySummary } from "@antarix/types/biometrics";

export const WHOOP_OAUTH_SCOPES = ["read:recovery", "read:sleep", "read:profile"] as const;

const DEFAULT_API_BASE = "https://api.prod.whoop.com";

export class WhoopApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Whoop API error ${status}`);
    this.name = "WhoopApiError";
    this.status = status;
    this.body = body;
  }
}

export interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  refresh_token_expires_in?: number;
}

export interface WhoopClientOpts {
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

interface WhoopListResponse<T> {
  records: T[];
  next_token: string | null;
}

interface WhoopRawCycle {
  id: number;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  start: string;
  end?: string;
  timezone_offset?: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  } | null;
  score_state?: string;
}

interface WhoopRawRecovery {
  cycle_id: number;
  sleep_id?: string | null;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  score?: {
    user_calibrating?: boolean;
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  } | null;
  score_state?: string;
}

interface WhoopRawSleep {
  id: string;
  cycle_id: number;
  v1_id?: number | null;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  start: string;
  end: string;
  timezone_offset?: string;
  nap?: boolean;
  score_state?: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_no_data_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
    sleep_cycle_count?: number;
    disturbance_count?: number;
    sleep_performance_percentage?: number;
    sleep_consistency_percentage?: number;
    respiratory_rate?: number;
  } | null;
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

export class WhoopClient {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly apiBase: string;

  constructor(opts: WhoopClientOpts) {
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.redirectUri = opts.redirectUri;
    this.apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<WhoopTokenResponse> {
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

  async refresh(refreshToken: string): Promise<WhoopTokenResponse> {
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
    cycleStart: string,
  ): Promise<WhoopDailySummary[]> {
    const query = `start=${encodeURIComponent(cycleStart)}&limit=25`;
    const [cycles, recoveries, sleeps] = await Promise.all([
      this.whoopListFetch<WhoopRawCycle>(accessToken, `/v1/cycle?${query}`),
      this.whoopListFetch<WhoopRawRecovery>(accessToken, `/v1/recovery?${query}`),
      this.whoopListFetch<WhoopRawSleep>(accessToken, `/v1/activity/sleep?${query}`),
    ]);

    const recoveryByCycle = new Map<number, WhoopRawRecovery>();
    for (const r of recoveries) recoveryByCycle.set(r.cycle_id, r);
    const sleepByCycle = new Map<number, WhoopRawSleep>();
    for (const s of sleeps) sleepByCycle.set(s.cycle_id, s);

    return cycles.map((c) => this.toSummary(c, recoveryByCycle.get(c.id), sleepByCycle.get(c.id)));
  }

  private toSummary(
    cycle: WhoopRawCycle,
    recovery: WhoopRawRecovery | undefined,
    sleep: WhoopRawSleep | undefined,
  ): WhoopDailySummary {
    const out: WhoopDailySummary = { cycle_start: cycle.start };
    if (recovery?.score?.recovery_score !== undefined) {
      out.recovery_score = recovery.score.recovery_score;
    }
    if (recovery?.score?.hrv_rmssd_milli !== undefined) {
      out.hrv_ms = recovery.score.hrv_rmssd_milli;
    }
    if (recovery?.score?.resting_heart_rate !== undefined) {
      out.resting_heart_rate = recovery.score.resting_heart_rate;
    }
    const totalInBedMs = sleep?.score?.stage_summary?.total_in_bed_time_milli;
    if (typeof totalInBedMs === "number") {
      out.sleep_duration_min = Math.round(totalInBedMs / 60000);
    }
    return out;
  }

  private async whoopListFetch<T>(accessToken: string, path: string): Promise<T[]> {
    const res = await this.fetchWithRetry(`${this.apiBase}${path}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    if (res.status < 200 || res.status >= 300) {
      const errBody = await readJsonSafely<unknown>(res);
      throw new WhoopApiError(res.status, errBody, `Whoop ${path} ${res.status}`);
    }
    const data = await readJsonSafely<WhoopListResponse<T>>(res);
    return data?.records ?? [];
  }

  private async tokenRequest(body: URLSearchParams): Promise<WhoopTokenResponse> {
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
      throw new WhoopApiError(res.status, errBody, `Whoop token endpoint ${res.status}`);
    }
    const data = await readJsonSafely<WhoopTokenResponse>(res);
    if (!data?.access_token || !data?.refresh_token) {
      throw new WhoopApiError(res.status, data, "Whoop token response missing access_token or refresh_token");
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
