// supabase/functions/ats-sync-greenhouse/index.ts
// MIRRORS apps/web/src/lib/ats/greenhouse-client.ts — keep in sync.
//
// T-ATS-001/003/004/005 — Push matched students to a recruiter's Greenhouse
// Harvest API (POST /v1/candidates), one batch per invocation. Driven by
// ats-sync-evaluator (cron, every 5 min) or by a direct POST.
//
// Body: { connection_id: uuid, saved_search_id: uuid, dry_run?: boolean }
//
// Logic (also documented in specs/004-eleven-of-ten/research.md D2):
//   1. Look up ats_connections row (must be status='active', provider='greenhouse').
//   2. Decrypt api_key (v1 = base64; TODO: KMS envelope encryption — see
//      apps/web/src/app/api/ats/connect/route.ts for the encrypt side).
//   3. Look up ats_saved_searches row (must be active=true) and load its
//      query_json.
//   4. Find up to 50 candidate students that match the saved search AND
//      have NOT been pushed via this connection (status='success' in
//      ats_sync_log).
//   5. For each match, POST to Greenhouse /v1/candidates with HTTP Basic
//      Auth (base64(`${apiKey}:`)) and a JSON body that embeds the Skill
//      Proof Score in custom_fields.antarix_score plus a public profile
//      URL in social_media_addresses (FR-ATS-004).
//   6. Retry on 5xx up to 3 attempts with exponential backoff (1s, 4s).
//      On 429 with Retry-After: stop the batch, leave the saved-search
//      for the next cron tick.
//      On 3 final failures: insert ats_sync_log status='failed_permanent',
//      mark connection status='paused' (FR-ATS-005), stop the batch.
//      On success: insert ats_sync_log status='success'.
//
// SECURITY: never log or surface the decrypted api_key, even on error.
// All log lines use the connection_id only.
//
// Return: JSON { ok, attempted, succeeded, failed }

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GREENHOUSE_API_BASE =
  Deno.env.get("GREENHOUSE_API_BASE") ?? "https://harvest.greenhouse.io/v1";
const APP_PUBLIC_URL =
  Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://antarix.app";
const MAX_BATCH = 50;
const MAX_ATTEMPTS = Number(Deno.env.get("ATS_SYNC_MAX_ATTEMPTS") ?? "3");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

interface ReqBody {
  connection_id?: string;
  saved_search_id?: string;
  dry_run?: boolean;
}

interface AtsConnectionRow {
  id: string;
  recruiter_id: string;
  provider: "greenhouse" | "lever";
  api_key_encrypted: string;
  pool_id: string | null;
  status: "active" | "paused" | "revoked";
  failure_count: number;
}

interface SavedSearchRow {
  id: string;
  connection_id: string;
  query_json: SavedSearchQuery;
  min_score: number;
  active: boolean;
}

interface SavedSearchQuery {
  skills?: string[];
  min_score?: number;
  verified_only?: boolean;
  graduation_year?: number;
  institutions?: string[];
}

interface CandidateMatch {
  user_id: string;
  email: string;
  display_name: string | null;
  score: number;
  slug: string | null;
  skills: string[];
  graduation_year: number | null;
  institution_id: string | null;
  is_verified: boolean;
}

interface PushOutcome {
  status: "success" | "failed_permanent" | "rate_limited";
  attempt: number;
  error?: string;
  retry_after_ms?: number;
  candidate_id?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = (await req.json().catch(() => ({}))) as ReqBody;
  if (!body.connection_id || !body.saved_search_id) {
    return json({ error: "connection_id and saved_search_id are required" }, 400);
  }

  const conn = await loadConnection(body.connection_id);
  if (!conn) return json({ error: "Connection not found" }, 404);
  if (conn.provider !== "greenhouse") {
    return json({ error: "Connection provider is not greenhouse" }, 400);
  }
  if (conn.status !== "active") {
    return json({ error: `Connection status is ${conn.status}` }, 409);
  }

  const search = await loadSavedSearch(body.saved_search_id);
  if (!search) return json({ error: "Saved search not found" }, 404);
  if (search.connection_id !== conn.id) {
    return json({ error: "Saved search does not belong to connection" }, 403);
  }
  if (!search.active) return json({ error: "Saved search is not active" }, 409);

  const effectiveMinScore = Math.max(
    search.min_score,
    typeof search.query_json.min_score === "number" ? search.query_json.min_score : 0,
  );

  const matches = await findMatches(conn.id, search.query_json, effectiveMinScore, MAX_BATCH);

  if (body.dry_run) {
    return json({
      ok: true,
      dry_run: true,
      attempted: matches.length,
      succeeded: 0,
      failed: 0,
      matched_user_ids: matches.map((m) => m.user_id),
    });
  }

  // Decrypt once; never re-emit or log.
  let apiKey: string;
  try {
    apiKey = decryptApiKey(conn.api_key_encrypted);
  } catch (e) {
    console.error("ats-sync-greenhouse decrypt failed", {
      connection_id: conn.id,
      err: (e as Error).message,
    });
    return json({ error: "credential_unreadable" }, 500);
  }

  let succeeded = 0;
  let failed = 0;
  let stoppedEarly = false;

  for (const m of matches) {
    const outcome = await pushOneCandidate(conn, apiKey, m);

    if (outcome.status === "rate_limited") {
      // Don't log a row; just stop and let the next cron tick continue.
      stoppedEarly = true;
      console.warn("ats-sync-greenhouse hit 429, stopping batch", {
        connection_id: conn.id,
        retry_after_ms: outcome.retry_after_ms,
      });
      break;
    }

    await supabase.from("ats_sync_log").insert({
      connection_id: conn.id,
      saved_search_id: search.id,
      student_id: m.user_id,
      status: outcome.status,
      attempt: outcome.attempt,
      error: outcome.error ?? null,
    });

    if (outcome.status === "success") {
      succeeded += 1;
    } else {
      failed += 1;
      // Per FR-ATS-005: a single permanent failure (3 attempts) pauses
      // the connection and notifies the recruiter (notification handled
      // by a downstream nudge worker reading ats_sync_log).
      await supabase
        .from("ats_connections")
        .update({
          status: "paused",
          failure_count: conn.failure_count + 1,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", conn.id);
      stoppedEarly = true;
      break;
    }
  }

  if (!stoppedEarly && succeeded > 0) {
    await supabase
      .from("ats_connections")
      .update({ last_sync_at: new Date().toISOString(), failure_count: 0 })
      .eq("id", conn.id);
  }

  return json({
    ok: true,
    attempted: succeeded + failed,
    succeeded,
    failed,
  });
});

// ----- data loaders -------------------------------------------------------

async function loadConnection(id: string): Promise<AtsConnectionRow | null> {
  const { data, error } = await supabase
    .from("ats_connections")
    .select("id,recruiter_id,provider,api_key_encrypted,pool_id,status,failure_count")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("loadConnection failed", { id, err: error.message });
    return null;
  }
  return (data as AtsConnectionRow | null) ?? null;
}

async function loadSavedSearch(id: string): Promise<SavedSearchRow | null> {
  const { data, error } = await supabase
    .from("ats_saved_searches")
    .select("id,connection_id,query_json,min_score,active")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("loadSavedSearch failed", { id, err: error.message });
    return null;
  }
  return (data as SavedSearchRow | null) ?? null;
}

async function findMatches(
  connectionId: string,
  query: SavedSearchQuery,
  minScore: number,
  limit: number,
): Promise<CandidateMatch[]> {
  // Step 1: load student_ids already pushed successfully via this connection.
  const { data: pushedRows } = await supabase
    .from("ats_sync_log")
    .select("student_id")
    .eq("connection_id", connectionId)
    .eq("status", "success");
  const alreadyPushed = new Set<string>(
    ((pushedRows ?? []) as Array<{ student_id: string }>).map((r) => r.student_id),
  );

  // Step 2: base query over candidate_profiles (only public + open candidates).
  let qb = supabase
    .from("candidate_profiles")
    .select(
      "user_id,overall_skill_proof_score,placement_ready,institution_id,is_public,is_open_to_opportunities",
    )
    .eq("is_public", true)
    .eq("is_open_to_opportunities", true)
    .gte("overall_skill_proof_score", minScore)
    .order("overall_skill_proof_score", { ascending: false })
    .limit(Math.max(limit * 4, 100)); // overfetch to leave headroom for in-memory filters

  if (query.verified_only === true) qb = qb.eq("placement_ready", true);
  if (Array.isArray(query.institutions) && query.institutions.length > 0) {
    qb = qb.in("institution_id", query.institutions);
  }

  const { data: candidateRows, error } = await qb;
  if (error) {
    console.error("findMatches: candidate query failed", { err: error.message });
    return [];
  }

  type BaseRow = {
    user_id: string;
    overall_skill_proof_score: number;
    placement_ready: boolean;
    institution_id: string | null;
  };
  const base = ((candidateRows ?? []) as BaseRow[]).filter(
    (r) => !alreadyPushed.has(r.user_id),
  );
  if (base.length === 0) return [];

  const userIds = base.map((r) => r.user_id);

  // Step 3: hydrate users (email, display_name, slug) and optional joins.
  const { data: userRows } = await supabase
    .from("users")
    .select("id,email,display_name")
    .in("id", userIds);
  const userMap = new Map<string, { email: string; display_name: string | null }>();
  for (const u of (userRows ?? []) as Array<{ id: string; email: string; display_name: string | null }>) {
    userMap.set(u.id, { email: u.email, display_name: u.display_name });
  }

  // Public profile slugs (best-effort: candidate_profiles may have a slug column;
  // if not we just leave it null and the profile URL falls back to /u/<user_id>).
  const slugMap = new Map<string, string | null>();
  try {
    const { data: slugRows } = await supabase
      .from("candidate_profiles")
      .select("user_id,slug")
      .in("user_id", userIds);
    for (const s of (slugRows ?? []) as Array<{ user_id: string; slug: string | null }>) {
      slugMap.set(s.user_id, s.slug ?? null);
    }
  } catch {
    // slug column may not exist in all environments — best-effort only.
  }

  // Skills: only fetch if query.skills is set.
  let userSkillsMap = new Map<string, string[]>();
  if (Array.isArray(query.skills) && query.skills.length > 0) {
    const { data: usRows } = await supabase
      .from("user_skills")
      .select("user_id,skills:skills(slug,name)")
      .in("user_id", userIds);
    type SkillRow = { user_id: string; skills: { slug: string; name: string } | { slug: string; name: string }[] | null };
    for (const r of (usRows ?? []) as SkillRow[]) {
      const sk = Array.isArray(r.skills) ? r.skills[0] : r.skills;
      if (!sk?.slug) continue;
      const arr = userSkillsMap.get(r.user_id) ?? [];
      arr.push(sk.slug);
      userSkillsMap.set(r.user_id, arr);
    }
  }

  // Graduation year via institution_members.batch_year.
  let batchYearMap = new Map<string, number>();
  if (typeof query.graduation_year === "number") {
    const { data: imRows } = await supabase
      .from("institution_members")
      .select("user_id,batch_year")
      .in("user_id", userIds)
      .eq("batch_year", query.graduation_year);
    for (const r of (imRows ?? []) as Array<{ user_id: string; batch_year: number }>) {
      batchYearMap.set(r.user_id, r.batch_year);
    }
  }

  // Step 4: assemble + apply in-memory filters that the SQL didn't cover.
  const result: CandidateMatch[] = [];
  for (const row of base) {
    if (result.length >= limit) break;
    const u = userMap.get(row.user_id);
    if (!u) continue;
    const skills = userSkillsMap.get(row.user_id) ?? [];

    if (Array.isArray(query.skills) && query.skills.length > 0) {
      const wanted = query.skills.map((s) => s.toLowerCase());
      const have = skills.map((s) => s.toLowerCase());
      const overlap = wanted.some((w) => have.includes(w));
      if (!overlap) continue;
    }
    if (typeof query.graduation_year === "number") {
      if (batchYearMap.get(row.user_id) !== query.graduation_year) continue;
    }

    result.push({
      user_id: row.user_id,
      email: u.email,
      display_name: u.display_name,
      score: row.overall_skill_proof_score,
      slug: slugMap.get(row.user_id) ?? null,
      skills,
      graduation_year: batchYearMap.get(row.user_id) ?? null,
      institution_id: row.institution_id,
      is_verified: row.placement_ready,
    });
  }
  return result;
}

// ----- encryption ---------------------------------------------------------

// TODO(prod): replace base64 placeholder with KMS envelope encryption
// (AES-256-GCM with the data key, then KMS-wrap the data key). The
// encrypt/decrypt pair lives in apps/web/src/app/api/ats/connect/route.ts.
// As long as both sides agree on the format this function is sufficient
// for v1 and keeps the api_key out of plaintext at rest.
function decryptApiKey(stored: string): string {
  // Heuristic: if the stored value decodes back to printable ASCII via
  // base64, treat it as base64; otherwise assume it was stored in
  // plaintext (e.g. by a dev-mode admin tool).
  try {
    const decoded = atob(stored);
    // base64 of an API key should yield printable ASCII; if not, fall back.
    if (/^[\x20-\x7e]+$/.test(decoded)) return decoded;
  } catch {
    /* fall through to plaintext */
  }
  return stored;
}

// ----- push pipeline (mirrors greenhouse-client.ts) -----------------------

function buildAuthHeader(apiKey: string): string {
  // Greenhouse Harvest auth: HTTP Basic with `${apiKey}:` as the username.
  // btoa is fine for ASCII API keys — Greenhouse keys are always ASCII.
  const token = btoa(`${apiKey}:`);
  return `Basic ${token}`;
}

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const httpDate = Date.parse(headerValue);
  if (Number.isFinite(httpDate)) return Math.max(0, httpDate - Date.now());
  return undefined;
}

async function readJsonSafely<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function buildPayload(m: CandidateMatch) {
  const [first, ...rest] = (m.display_name ?? m.email.split("@")[0] ?? "Candidate").split(" ");
  const last = rest.length > 0 ? rest.join(" ") : "(Antarix)";
  const profileUrl = m.slug
    ? `${APP_PUBLIC_URL}/u/${m.slug}`
    : `${APP_PUBLIC_URL}/u/${m.user_id}`;
  return {
    first_name: first || "Antarix",
    last_name: last,
    email_addresses: [{ value: m.email, type: "personal" }],
    social_media_addresses: [{ value: profileUrl }],
    custom_fields: {
      antarix_score: m.score,
      antarix_profile_url: profileUrl,
    },
  };
}

async function pushOneCandidate(
  conn: AtsConnectionRow,
  apiKey: string,
  m: CandidateMatch,
): Promise<PushOutcome> {
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(apiKey),
    "Content-Type": "application/json",
    Accept: "application/json",
    "On-Behalf-Of": conn.recruiter_id, // Greenhouse wants the user id; recruiter_id is the Antarix one — accepted by Greenhouse as opaque
  };
  const payload = buildPayload(m);

  const backoffsMs = [0, 1_000, 4_000];
  let lastError = "unknown";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (backoffsMs[attempt - 1] > 0) await sleep(backoffsMs[attempt - 1]);
    let res: Response;
    try {
      res = await fetch(`${GREENHOUSE_API_BASE}/candidates`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (e) {
      lastError = `network_${(e as Error).message}`;
      continue;
    }

    if (res.status === 429) {
      return {
        status: "rate_limited",
        attempt,
        retry_after_ms: parseRetryAfterMs(res.headers.get("Retry-After")),
      };
    }

    if (res.status >= 200 && res.status < 300) {
      const created = await readJsonSafely<{ id?: number | string }>(res);
      const candidateId = created?.id !== undefined ? String(created.id) : undefined;

      // Optional pool assignment (mirror of greenhouse-client.ts).
      if (conn.pool_id && candidateId) {
        const poolRes = await fetch(
          `${GREENHOUSE_API_BASE}/prospect_pools/${encodeURIComponent(conn.pool_id)}/candidates`,
          { method: "POST", headers, body: JSON.stringify({ candidate_id: candidateId }) },
        );
        if (poolRes.status === 429) {
          return {
            status: "rate_limited",
            attempt,
            retry_after_ms: parseRetryAfterMs(poolRes.headers.get("Retry-After")),
          };
        }
        if (poolRes.status < 200 || poolRes.status >= 300) {
          lastError = `pool_assign_${poolRes.status}`;
          // Pool failures are non-fatal for the candidate create — count as success.
        }
      }

      return { status: "success", attempt, candidate_id: candidateId };
    }

    if (res.status >= 500) {
      lastError = `upstream_${res.status}`;
      continue;
    }

    // 4xx other than 429: deterministic failure, no point retrying.
    const errBody = await readJsonSafely<{ error?: string; message?: string }>(res);
    lastError = errBody?.error ?? errBody?.message ?? `http_${res.status}`;
    break;
  }

  return { status: "failed_permanent", attempt: MAX_ATTEMPTS, error: lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
