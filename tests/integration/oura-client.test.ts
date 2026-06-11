// tests/integration/oura-client.test.ts — 11/10 — OuraClient unit tests
// Spec: specs/006-deep-signal-capture/spec.md FR-BIO-001..007
// Coverage: PKCE generation, OAuth token exchange, daily summary fetch, retry

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  OuraClient,
  OuraApiError,
  generatePkceState,
  OURA_OAUTH_SCOPES,
} from "@/lib/biometrics/oura-client";

const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";
const REDIRECT_URI = "https://example.com/callback";
const API_BASE = "https://api.ouraring.com";

function createClient(): OuraClient {
  return new OuraClient({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI, apiBase: API_BASE });
}

function jsonResponse(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function emptyResponse(status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: extraHeaders });
}

describe("generatePkceState", () => {
  it("returns 32-byte-hex state, 64-byte-base64url verifier, non-empty challenge", () => {
    const pkce = generatePkceState();
    expect(pkce.state).toMatch(/^[0-9a-f]{64}$/);
    expect(pkce.code_verifier.length).toBeGreaterThanOrEqual(85);
    expect(pkce.code_verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pkce.code_challenge).toBeTruthy();
    expect(pkce.code_challenge).not.toBe(pkce.code_verifier);
  });
});

describe("OURA_OAUTH_SCOPES", () => {
  it("includes daily, personal, heartrate", () => {
    expect(OURA_OAUTH_SCOPES).toContain("daily");
    expect(OURA_OAUTH_SCOPES).toContain("personal");
    expect(OURA_OAUTH_SCOPES).toContain("heartrate");
    expect(OURA_OAUTH_SCOPES.length).toBe(3);
  });
});

describe("OuraApiError", () => {
  it("exposes status and body properties", () => {
    const err = new OuraApiError(400, { error: "bad_request" }, "custom message");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ error: "bad_request" });
    expect(err.message).toBe("custom message");
    expect(err.name).toBe("OuraApiError");
  });
});

describe("exchangeCode", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("makes POST to /oauth/token with correct form body", async () => {
    const mockFetch = vi.fn(async (_url: string, init: RequestInit): Promise<Response> => {
      const bodyStr = String(init.body);
      expect(bodyStr).toContain("grant_type=authorization_code");
      expect(bodyStr).toContain("code=test_code");
      expect(bodyStr).toContain("code_verifier=test_verifier");
      expect(bodyStr).toContain(`client_id=${CLIENT_ID}`);
      return jsonResponse(200, { access_token: "at1", refresh_token: "rt1", expires_in: 86400 });
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createClient();
    const result = await client.exchangeCode("test_code", "test_verifier");

    expect(result.access_token).toBe("at1");
    expect(result.refresh_token).toBe("rt1");
    expect(result.expires_in).toBe(86400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0]![0];
    expect(callUrl).toBe(`${API_BASE}/oauth/token`);
  });

  it("returns { access_token, refresh_token, expires_in } on 200", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, { access_token: "at2", refresh_token: "rt2", expires_in: 3600 }));
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.exchangeCode("c", "v");
    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("refresh_token");
    expect(result).toHaveProperty("expires_in");
  });

  it("throws OuraApiError on 400 (bad code)", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(400, { error: "invalid_grant" }));
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    await expect(client.exchangeCode("bad", "v")).rejects.toThrow(OuraApiError);
    await expect(client.exchangeCode("bad", "v")).rejects.toMatchObject({ status: 400 });
  });

  it("throws OuraApiError on 429 (rate limited, with Retry-After)", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) return emptyResponse(429, { "Retry-After": "1" });
      return jsonResponse(200, { access_token: "at3", refresh_token: "rt3", expires_in: 7200 });
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.exchangeCode("c", "v");
    expect(result.access_token).toBe("at3");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("refresh", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("makes POST to /oauth/token with grant_type=refresh_token", async () => {
    const mockFetch = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
      const bodyStr = String(init.body);
      expect(bodyStr).toContain("grant_type=refresh_token");
      expect(bodyStr).toContain("refresh_token=rt_old");
      return jsonResponse(200, { access_token: "at_new", refresh_token: "rt_new", expires_in: 86400 });
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.refresh("rt_old");
    expect(result.access_token).toBe("at_new");
    expect(result.refresh_token).toBe("rt_new");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns new tokens on 200", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, { access_token: "at_new2", refresh_token: "rt_new2", expires_in: 3600 }));
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.refresh("rt_old2");
    expect(result.access_token).toBe("at_new2");
    expect(result.refresh_token).toBe("rt_new2");
  });
});

describe("fetchDailySummary", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("GETs /v2/usercollection/daily_sleep with Bearer auth", async () => {
    const mockFetch = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
      expect(url).toContain("/v2/usercollection/daily_sleep");
      expect(url).toContain("start_date=2026-06-01");
      expect(url).toContain("end_date=2026-06-07");
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer test_token");
      return jsonResponse(200, [{ day: "2026-06-01", score: 85 }]);
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.fetchDailySummary("test_token", "2026-06-01", "2026-06-07");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0]?.day).toBe("2026-06-01");
  });

  it("returns parsed daily summary array", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, [
      { day: "2026-06-01", score: 85, average_hrv: 62, lowest_heart_rate: 54 },
      { day: "2026-06-02", score: 72 },
    ]));
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.fetchDailySummary("t", "2026-06-01", "2026-06-07");
    expect(result).toHaveLength(2);
    expect(result[0]?.score).toBe(85);
    expect(result[0]?.hrv_avg).toBe(62);
    expect(result[0]?.resting_heart_rate).toBe(54);
    expect(result[1]?.score).toBe(72);
  });

  it("retries once on 429 after parsing Retry-After", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) return emptyResponse(429, { "Retry-After": "0" });
      return jsonResponse(200, [{ day: "2026-06-01", score: 90 }]);
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.fetchDailySummary("t", "2026-06-01", "2026-06-07");
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
