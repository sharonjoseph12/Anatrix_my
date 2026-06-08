// apps/web/src/lib/ats/greenhouse-client.ts
// Greenhouse Harvest API client — POST candidate to a pool with custom field.
// Rate limit per Greenhouse: 50 req per 10s per API key.
//
// Spec: specs/004-eleven-of-ten/contracts/api.md
//   - HTTP Basic Auth: base64(`${apiKey}:`)
//   - 2xx → return ok=true + parsed candidate_id
//   - 429 → parse Retry-After → ok=false + retry_after_ms
//   - 5xx → ok=false (caller retries with exponential backoff)
//   - 4xx (other) → ok=false with error
//
// No SDK: a thin `fetch()` wrapper keeps the dependency surface small and
// makes the contract easy to mock in tests.

export interface GreenhouseCandidatePayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  social_media_addresses?: Array<{ value: string }>;
  custom_fields?: Record<string, string | number>;
  application?: { credited_to?: string; source_id?: number };
}

export interface GreenhousePushResult {
  ok: boolean;
  candidate_id?: string;
  status: number;
  error?: string;
  retry_after_ms?: number;
}

export interface GreenhouseClientOpts {
  apiKey: string;
  apiBase?: string;
  onBehalfOf?: string;
}

const DEFAULT_API_BASE = "https://harvest.greenhouse.io/v1";

function buildAuthHeader(apiKey: string): string {
  const token = Buffer.from(`${apiKey}:`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const httpDate = Date.parse(headerValue);
  if (Number.isFinite(httpDate)) {
    return Math.max(0, httpDate - Date.now());
  }
  return undefined;
}

interface GreenhouseCreateResponse {
  id?: number | string;
  status?: string;
}

interface GreenhouseErrorBody {
  error?: string;
  message?: string;
}

async function readJsonSafely<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function pushCandidate(
  opts: GreenhouseClientOpts,
  candidate: GreenhouseCandidatePayload,
  poolId?: string,
): Promise<GreenhousePushResult> {
  const apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  const auth = buildAuthHeader(opts.apiKey);

  const headers: Record<string, string> = {
    "Authorization": auth,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (opts.onBehalfOf) {
    headers["On-Behalf-Of"] = opts.onBehalfOf;
  }

  const createRes = await fetch(`${apiBase}/candidates`, {
    method: "POST",
    headers,
    body: JSON.stringify(candidate),
  });

  if (createRes.status === 429) {
    return {
      ok: false,
      status: 429,
      error: "rate_limited",
      retry_after_ms: parseRetryAfterMs(createRes.headers.get("Retry-After")),
    };
  }

  if (createRes.status >= 500) {
    return {
      ok: false,
      status: createRes.status,
      error: `upstream_${createRes.status}`,
    };
  }

  if (createRes.status < 200 || createRes.status >= 300) {
    const body = await readJsonSafely<GreenhouseErrorBody>(createRes);
    return {
      ok: false,
      status: createRes.status,
      error: body?.error ?? body?.message ?? `http_${createRes.status}`,
    };
  }

  const created = await readJsonSafely<GreenhouseCreateResponse>(createRes);
  const candidateId = created?.id !== undefined ? String(created.id) : undefined;

  if (!poolId) {
    return { ok: true, status: createRes.status, candidate_id: candidateId };
  }

  if (!candidateId) {
    return {
      ok: false,
      status: createRes.status,
      error: "candidate_created_without_id",
    };
  }

  const poolRes = await fetch(`${apiBase}/prospect_pools/${encodeURIComponent(poolId)}/candidates`, {
    method: "POST",
    headers,
    body: JSON.stringify({ candidate_id: candidateId }),
  });

  if (poolRes.status === 429) {
    return {
      ok: false,
      status: 429,
      candidate_id: candidateId,
      error: "rate_limited",
      retry_after_ms: parseRetryAfterMs(poolRes.headers.get("Retry-After")),
    };
  }

  if (poolRes.status < 200 || poolRes.status >= 300) {
    const body = await readJsonSafely<GreenhouseErrorBody>(poolRes);
    return {
      ok: false,
      status: poolRes.status,
      candidate_id: candidateId,
      error: body?.error ?? body?.message ?? `pool_assign_failed_${poolRes.status}`,
    };
  }

  return { ok: true, status: poolRes.status, candidate_id: candidateId };
}
