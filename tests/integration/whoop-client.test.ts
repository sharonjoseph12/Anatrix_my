// tests/integration/whoop-client.test.ts — 11/10 — WhoopClient unit tests
// Spec: specs/006-deep-signal-capture/spec.md FR-BIO-001..007
// Coverage: OAuth token exchange, parallel daily summary fetch, WhoopApiError

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WhoopClient,
  WhoopApiError,
  WHOOP_OAUTH_SCOPES,
} from "@/lib/biometrics/whoop-client";

const CLIENT_ID = "test-whoop-id";
const CLIENT_SECRET = "test-whoop-secret";
const REDIRECT_URI = "https://example.com/whoop-callback";
const API_BASE = "https://api.prod.whoop.com";

function createClient(): WhoopClient {
  return new WhoopClient({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI, apiBase: API_BASE });
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

function whoopListResponse(records: unknown[]): Response {
  return jsonResponse(200, { records, next_token: null });
}

describe("WHOOP_OAUTH_SCOPES", () => {
  it("includes read:recovery, read:sleep, read:profile", () => {
    expect(WHOOP_OAUTH_SCOPES).toContain("read:recovery");
    expect(WHOOP_OAUTH_SCOPES).toContain("read:sleep");
    expect(WHOOP_OAUTH_SCOPES).toContain("read:profile");
    expect(WHOOP_OAUTH_SCOPES.length).toBe(3);
  });
});

describe("WhoopApiError", () => {
  it("exposes status and body properties", () => {
    const err = new WhoopApiError(401, { error: "unauthorized" }, "custom msg");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(401);
    expect(err.body).toEqual({ error: "unauthorized" });
    expect(err.name).toBe("WhoopApiError");
  });
});

describe("exchangeCode", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("makes POST to /oauth/token with correct form body", async () => {
    const mockFetch = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
      expect(url).toBe(`${API_BASE}/oauth/token`);
      const bodyStr = String(init.body);
      expect(bodyStr).toContain("grant_type=authorization_code");
      expect(bodyStr).toContain("code=whoop_code");
      return jsonResponse(200, { access_token: "wat", refresh_token: "wrt", expires_in: 86400 });
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.exchangeCode("whoop_code", "whoop_verifier");
    expect(result.access_token).toBe("wat");
    expect(result.refresh_token).toBe("wrt");
  });

  it("returns tokens on 200", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, { access_token: "at", refresh_token: "rt", expires_in: 3600 }));
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.exchangeCode("c", "v");
    expect(result.access_token).toBe("at");
    expect(result.refresh_token).toBe("rt");
  });

  it("throws WhoopApiError on 400", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(400, { error: "invalid_grant" }));
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    await expect(client.exchangeCode("bad", "v")).rejects.toThrow(WhoopApiError);
  });
});

describe("refresh", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("makes POST to /oauth/token with grant_type=refresh_token", async () => {
    const mockFetch = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
      expect(String(init.body)).toContain("grant_type=refresh_token");
      expect(String(init.body)).toContain("refresh_token=old_rt");
      return jsonResponse(200, { access_token: "new_at", refresh_token: "new_rt", expires_in: 86400 });
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.refresh("old_rt");
    expect(result.access_token).toBe("new_at");
  });

  it("returns new tokens on 200", async () => {
    const mockFetch = vi.fn(async () => jsonResponse(200, { access_token: "at2", refresh_token: "rt2", expires_in: 43200 }));
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.refresh("old");
    expect(result.refresh_token).toBe("rt2");
  });
});

describe("fetchDailySummary", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("does 3 parallel fetches and joins them", async () => {
    const mockFetch = vi.fn(async (url: string): Promise<Response> => {
      if (url.includes("/v1/cycle")) {
        return whoopListResponse([{ id: 1, start: "2026-06-01T10:00:00Z", score: { strain: 8.5 } }]);
      }
      if (url.includes("/v1/recovery")) {
        return whoopListResponse([{ cycle_id: 1, score: { recovery_score: 72, hrv_rmssd_milli: 58, resting_heart_rate: 52 } }]);
      }
      if (url.includes("/v1/activity/sleep")) {
        return whoopListResponse([{ id: "s1", cycle_id: 1, start: "2026-06-01T00:00:00Z", end: "2026-06-01T07:00:00Z", score: { stage_summary: { total_in_bed_time_milli: 420 * 60 * 1000 } } }]);
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.fetchDailySummary("test_token", "2026-06-01");
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(1);
    expect(result[0]?.cycle_start).toBe("2026-06-01T10:00:00Z");
  });

  it("returns joined summary with recovery, hrv, rhr, sleep_duration", async () => {
    const mockFetch = vi.fn(async (url: string): Promise<Response> => {
      if (url.includes("/v1/cycle")) return whoopListResponse([{ id: 10, start: "2026-06-02T08:00:00Z" }]);
      if (url.includes("/v1/recovery")) return whoopListResponse([{ cycle_id: 10, score: { recovery_score: 85, hrv_rmssd_milli: 62, resting_heart_rate: 50 } }]);
      if (url.includes("/v1/activity/sleep")) return whoopListResponse([{ id: "s10", cycle_id: 10, start: "2026-06-02T00:00:00Z", end: "2026-06-02T07:30:00Z", score: { stage_summary: { total_in_bed_time_milli: 450 * 60 * 1000 } } }]);
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.fetchDailySummary("t", "2026-06-02");
    expect(result[0]?.recovery_score).toBe(85);
    expect(result[0]?.hrv_ms).toBe(62);
    expect(result[0]?.resting_heart_rate).toBe(50);
    expect(result[0]?.sleep_duration_min).toBe(450);
  });

  it("throws WhoopApiError on non-200 cycle fetch", async () => {
    const mockFetch = vi.fn(async (url: string): Promise<Response> => {
      if (url.includes("/v1/cycle")) return emptyResponse(401);
      return whoopListResponse([]);
    });
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    await expect(client.fetchDailySummary("bad_token", "2026-06-01")).rejects.toThrow(WhoopApiError);
  });

  it("handles empty lists from all endpoints", async () => {
    const mockFetch = vi.fn(async () => whoopListResponse([]));
    vi.stubGlobal("fetch", mockFetch);
    const client = createClient();
    const result = await client.fetchDailySummary("t", "2026-06-01");
    expect(result).toEqual([]);
  });
});
