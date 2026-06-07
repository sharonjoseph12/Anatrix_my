// tests/integration/greenhouse-client.test.ts
// Unit tests for apps/web/src/lib/ats/greenhouse-client.ts
//
// Coverage (per task spec):
//   - Successful POST → ok=true, candidate_id parsed
//   - 429 with Retry-After: 5 → ok=false, retry_after_ms=5000
//   - 401 → ok=false with error
//   - 500 → ok=false (let caller retry)
//
// We mock the global `fetch` with a `vi.fn` and assert on the request shape
// (URL, method, headers, body) and the parsed result.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { pushCandidate } from "@/lib/ats/greenhouse-client";
import type { GreenhouseCandidatePayload } from "@/lib/ats/greenhouse-client";

const CANDIDATE: GreenhouseCandidatePayload = {
  first_name: "Ada",
  last_name: "Lovelace",
  email: "[email protected]",
  custom_fields: { antarix_score: 91 },
  social_media_addresses: [{ value: "https://antarix.example/u/ada" }],
};

const API_KEY = "greenhouse_api_key_xyz";
const API_BASE = "https://harvest.test.greenhouse.io/v1";

interface FetchCall {
  url: string;
  init: RequestInit;
}

function makeFetchMock(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    calls.push({ url, init: init ?? {} });
    return impl(url, init ?? {});
  });
  return { fn, calls };
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

describe("greenhouse-client.pushCandidate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok=true and the parsed candidate_id on 201", async () => {
    const { fn } = makeFetchMock(async (url) => {
      if (url.endsWith("/candidates")) {
        return jsonResponse(201, { id: 4242, status: "new" });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fn);

    const result = await pushCandidate({ apiKey: API_KEY, apiBase: API_BASE }, CANDIDATE);
    expect(result.ok).toBe(true);
    expect(result.candidate_id).toBe("4242");
    expect(result.status).toBe(201);

    expect(fn).toHaveBeenCalledTimes(1);
    const call = fn.mock.calls[0]!;
    const [calledUrl, calledInit] = call as unknown as [string, RequestInit];
    expect(calledUrl).toBe(`${API_BASE}/candidates`);
    expect(calledInit.method).toBe("POST");
    expect((calledInit.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`${API_KEY}:`, "utf8").toString("base64")}`,
    );
    expect(JSON.parse(String(calledInit.body))).toEqual(CANDIDATE);
  });

  it("returns ok=false with retry_after_ms=5000 on 429 with Retry-After: 5", async () => {
    const { fn } = makeFetchMock(async () => emptyResponse(429, { "Retry-After": "5" }));
    vi.stubGlobal("fetch", fn);

    const result = await pushCandidate({ apiKey: API_KEY, apiBase: API_BASE }, CANDIDATE);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.retry_after_ms).toBe(5000);
    expect(result.error).toBe("rate_limited");
  });

  it("returns ok=false with parsed error on 401", async () => {
    const { fn } = makeFetchMock(async () => jsonResponse(401, { error: "invalid_api_key" }));
    vi.stubGlobal("fetch", fn);

    const result = await pushCandidate({ apiKey: API_KEY, apiBase: API_BASE }, CANDIDATE);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("invalid_api_key");
  });

  it("returns ok=false on 500 so the caller can retry", async () => {
    const { fn } = makeFetchMock(async () => emptyResponse(500));
    vi.stubGlobal("fetch", fn);

    const result = await pushCandidate({ apiKey: API_KEY, apiBase: API_BASE }, CANDIDATE);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("upstream_500");
  });

  it("creates the candidate and then assigns to a prospect pool when poolId is set", async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method: init?.method ?? "GET", body });
      if (url.endsWith("/candidates")) {
        return jsonResponse(201, { id: 9999 });
      }
      if (url.includes("/prospect_pools/pool_abc/candidates")) {
        return jsonResponse(201, { status: "added" });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fn);

    const result = await pushCandidate({ apiKey: API_KEY, apiBase: API_BASE }, CANDIDATE, "pool_abc");
    expect(result.ok).toBe(true);
    expect(result.candidate_id).toBe("9999");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe(`${API_BASE}/candidates`);
    expect(calls[1]?.url).toBe(`${API_BASE}/prospect_pools/pool_abc/candidates`);
    expect(calls[1]?.body).toEqual({ candidate_id: "9999" });
  });

  it("propagates 429 from the prospect-pool add with the parsed retry_after_ms", async () => {
    const fn = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/candidates")) return jsonResponse(201, { id: 7 });
      if (url.includes("/prospect_pools/pool_zzz/candidates")) {
        return emptyResponse(429, { "Retry-After": "2" });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fn);

    const result = await pushCandidate({ apiKey: API_KEY, apiBase: API_BASE }, CANDIDATE, "pool_zzz");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.retry_after_ms).toBe(2000);
    expect(result.candidate_id).toBe("7");
  });
});
