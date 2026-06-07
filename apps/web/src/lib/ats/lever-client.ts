// apps/web/src/lib/ats/lever-client.ts
// Lever v1 API client — POST candidate with profile link, score, and tags.
//
// Spec: specs/004-eleven-of-ten/contracts/api.md
//   - HTTP Basic Auth: base64(`${apiKey}:`)  (Lever uses the same scheme as Greenhouse)
//   - 2xx → return ok=true + parsed candidate_id
//   - 429 → parse Retry-After → ok=false + retry_after_ms
//   - 5xx → ok=false (caller retries)
//   - 4xx (other) → ok=false with error
//
// Lever does not have a "pool" concept like Greenhouse — applications are
// against postings, so pushCandidate takes no poolId.

export interface LeverCandidatePayload {
  name: string;
  emails: string[];
  phones?: Array<{ value: string; type?: string }>;
  links?: string[];
  tags?: string[];
  archived?: { archivedAt?: number; reason?: string };
  [extraField: string]: unknown;
}

export interface LeverPushResult {
  ok: boolean;
  candidate_id?: string;
  status: number;
  error?: string;
  retry_after_ms?: number;
}

export interface LeverClientOpts {
  apiKey: string;
  apiBase?: string;
}

const DEFAULT_API_BASE = "https://api.lever.co/v1";

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

interface LeverCreateResponse {
  data?: { id?: string };
  id?: string;
}

interface LeverErrorBody {
  error?: string;
  message?: string;
  errors?: Record<string, string>;
}

async function readJsonSafely<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function pushCandidate(
  opts: LeverClientOpts,
  candidate: LeverCandidatePayload,
): Promise<LeverPushResult> {
  const apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  const auth = buildAuthHeader(opts.apiKey);

  const res = await fetch(`${apiBase}/candidates`, {
    method: "POST",
    headers: {
      "Authorization": auth,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(candidate),
  });

  if (res.status === 429) {
    return {
      ok: false,
      status: 429,
      error: "rate_limited",
      retry_after_ms: parseRetryAfterMs(res.headers.get("Retry-After")),
    };
  }

  if (res.status >= 500) {
    return {
      ok: false,
      status: res.status,
      error: `upstream_${res.status}`,
    };
  }

  if (res.status < 200 || res.status >= 300) {
    const body = await readJsonSafely<LeverErrorBody>(res);
    const detail =
      body?.message
      ?? body?.error
      ?? (body?.errors ? JSON.stringify(body.errors) : undefined)
      ?? `http_${res.status}`;
    return {
      ok: false,
      status: res.status,
      error: detail,
    };
  }

  const created = await readJsonSafely<LeverCreateResponse>(res);
  const candidateId = created?.data?.id ?? created?.id;
  return {
    ok: true,
    status: res.status,
    candidate_id: candidateId !== undefined ? String(candidateId) : undefined,
  };
}
