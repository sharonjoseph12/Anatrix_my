// supabase/functions/biometric-correlator/index.ts
//
// Spec: specs/006-deep-signal-capture/spec.md FR-BIO-001..007, FR-PRI-004
// Data model: specs/006-deep-signal-capture/data-model.md lines 241-265
//
// Nightly job: for every active biometric_connection (Oura + Whoop),
// fetch provider data, aggregate into biometric_aggregates, correlate
// with the 002 peak-window detector and latest IDE aggregates, and
// write peak_window_inferences rows with a signal_audit trail.
//
// MIRRORS apps/web/src/lib/biometrics/{oura-client,whoop-client,aggregator,correlator}.ts
// — keep in sync. Edge Functions cannot import from apps/web, so the
// algorithm is duplicated inline.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";
import { hashStructured } from "../../../packages/utils/hash-structured.ts";

// ----- env ------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OURA_CLIENT_ID = Deno.env.get("OURA_CLIENT_ID") ?? "";
const OURA_CLIENT_SECRET = Deno.env.get("OURA_CLIENT_SECRET") ?? "";
const WHOOP_CLIENT_ID = Deno.env.get("WHOOP_CLIENT_ID") ?? "";
const WHOOP_CLIENT_SECRET = Deno.env.get("WHOOP_CLIENT_SECRET") ?? "";
const OURA_API_BASE = "https://api.ouraring.com";
const WHOOP_API_BASE = "https://api.prod.whoop.com";
const RATE_LIMIT_MS = 1000;
const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CONFIDENCE_MAX = 0.95;
const IDE_SCORE_CAP = 3;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----- types ----------------------------------------------------------------

interface BiometricConnectionRow {
  id: string;
  student_id: string;
  provider: string;
  status: string;
  oauth_refresh_token_encrypted: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  scopes_json: Record<string, unknown>;
}

interface ProviderTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface OuraRawSleep {
  id?: string;
  day?: string;
  score?: number | null;
  average_hrv?: number | null;
  average_heart_rate?: number | null;
  lowest_heart_rate?: number | null;
}

interface WhoopRawCycle {
  id: number;
  start: string;
  end?: string;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  } | null;
  score_state?: string;
}

interface WhoopRawRecovery {
  cycle_id: number;
  sleep_id?: string | null;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
  } | null;
  score_state?: string;
}

interface WhoopRawSleep {
  id: string;
  cycle_id: number;
  start: string;
  end: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
    };
    sleep_performance_percentage?: number;
  } | null;
}

interface OuraDailySummary {
  day: string;
  score?: number;
  hrv_avg?: number;
  resting_heart_rate?: number;
}

interface WhoopDailySummary {
  cycle_start: string;
  recovery_score?: number;
  hrv_ms?: number;
  resting_heart_rate?: number;
  sleep_duration_min?: number;
}

interface BiometricAggregateRow {
  connection_id: string;
  student_id: string;
  provider: string;
  period_type: string;
  period_start: string;
  sleep_duration_minutes: number | null;
  sleep_quality_score: number | null;
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
  daily_readiness_score: number | null;
  source_hash: string;
}

interface DetectorOutput {
  window_start: string;
  window_end: string;
  confidence: number;
}

interface IDEAggregateRow {
  id: string;
  device_id: string;
  student_id: string;
  day: string;
  period_type: string;
  period_start: string;
  session_count: number;
  total_active_seconds: number;
  productivity_score_raw: number;
  score_contribution: number;
}

interface PeakWindowInferenceRow {
  student_id: string;
  window_start: string;
  window_end: string;
  confidence: number;
  biometric_inputs_hash: string | null;
  ide_inputs_hash: string | null;
  detector_inputs_hash: string;
  source_mix: Record<string, number>;
}

interface SourceMix {
  biometric: number;
  ide: number;
  "002_detector": number;
}

// ----- crypto helpers (Deno Web Crypto API) --------------------------------

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

async function hashStructured(value: unknown): Promise<string> {
  return sha256Hex(stableStringify(value));
}

// ----- pgsodium helpers ----------------------------------------------------

async function decryptSecret(encrypted: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("decrypt_secret", {
      secret: encrypted,
      key_id: null,
      add_header: false,
    });
    if (error) throw error;
    return data as string;
  } catch {
    return atob(encrypted);
  }
}

async function encryptSecret(plaintext: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("encrypt_secret", {
      secret: plaintext,
      key_id: null,
      add_header: false,
    });
    if (error) throw error;
    return data as string;
  } catch {
    return btoa(plaintext);
  }
}

// ----- rate limiter --------------------------------------------------------

const lastProviderCall = new Map<string, number>();

async function rateLimitProvider(provider: string): Promise<void> {
  const last = lastProviderCall.get(provider) ?? 0;
  const now = Date.now();
  const elapsed = now - last;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise<void>((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastProviderCall.set(provider, Date.now());
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms));
}

// ----- fetch helpers -------------------------------------------------------

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

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const first = await fetch(url, init);
  if (first.status !== 429) return first;
  const waitMs = parseRetryAfterMs(first.headers.get("Retry-After"));
  console.warn("rate-limited", { url, retryAfterMs: waitMs });
  await sleep(waitMs);
  return fetch(url, init);
}

// ----- provider token refresh ----------------------------------------------

async function refreshProviderToken(
  provider: string,
  currentRefreshToken: string,
): Promise<{ access_token: string; new_refresh_token: string | null }> {
  const clientId = provider === "oura" ? OURA_CLIENT_ID : WHOOP_CLIENT_ID;
  const clientSecret = provider === "oura" ? OURA_CLIENT_SECRET : WHOOP_CLIENT_SECRET;
  const apiBase = provider === "oura" ? OURA_API_BASE : WHOOP_API_BASE;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: currentRefreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${apiBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Token refresh failed for ${provider}: ${res.status} ${errBody}`);
  }

  const data: ProviderTokenResponse = await res.json();
  return {
    access_token: data.access_token,
    new_refresh_token: data.refresh_token ?? null,
  };
}

// ----- Oura API ------------------------------------------------------------

async function fetchOuraDaily(
  accessToken: string,
  date: string,
): Promise<OuraDailySummary[]> {
  const endDate = date;
  const startDate = new Date(new Date(date).getTime() - 2 * 86400000)
    .toISOString().slice(0, 10);
  const qs = `start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  const url = `${OURA_API_BASE}/v2/usercollection/daily_sleep?${qs}`;

  const res = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok && res.status !== 401) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Oura daily_sleep ${res.status}: ${errBody}`);
  }
  if (res.status === 401) {
    throw new Error("Oura API returned 401");
  }

  const json = await res.json() as { data?: OuraRawSleep[] };
  const items = json?.data ?? [];
  return items.map((d) => {
    const out: OuraDailySummary = { day: d.day ?? "" };
    if (typeof d.score === "number") out.score = d.score;
    if (typeof d.average_hrv === "number") out.hrv_avg = d.average_hrv;
    const rhr = d.lowest_heart_rate ?? d.average_heart_rate;
    if (typeof rhr === "number") out.resting_heart_rate = rhr;
    return out;
  });
}

// ----- Whoop API -----------------------------------------------------------

async function whoopListFetch<T>(
  accessToken: string,
  path: string,
): Promise<T[]> {
  const url = `${WHOOP_API_BASE}${path}`;
  const res = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok && res.status !== 401) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Whoop ${path} ${res.status}: ${errBody}`);
  }
  if (res.status === 401) {
    throw new Error("Whoop API returned 401");
  }

  const json = await res.json() as { records?: T[] };
  return json?.records ?? [];
}

async function fetchWhoopDaily(
  accessToken: string,
  cycleStart: string,
): Promise<WhoopDailySummary[]> {
  const query = `start=${encodeURIComponent(cycleStart)}&limit=25`;
  const [cycles, recoveries, sleeps] = await Promise.all([
    whoopListFetch<WhoopRawCycle>(accessToken, `/v1/cycle?${query}`),
    whoopListFetch<WhoopRawRecovery>(accessToken, `/v1/recovery?${query}`),
    whoopListFetch<WhoopRawSleep>(accessToken, `/v1/activity/sleep?${query}`),
  ]);

  const recoveryByCycle = new Map<number, WhoopRawRecovery>();
  for (const r of recoveries) recoveryByCycle.set(r.cycle_id, r);
  const sleepByCycle = new Map<number, WhoopRawSleep>();
  for (const s of sleeps) sleepByCycle.set(s.cycle_id, s);

  return cycles.map((c) => {
    const recovery = recoveryByCycle.get(c.id);
    const sleep = sleepByCycle.get(c.id);
    const out: WhoopDailySummary = { cycle_start: c.start };
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
  });
}

// ----- aggregate helpers ---------------------------------------------------

function numericOrNull(v: number | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

async function aggregateDaily(
  provider: string,
  data: OuraDailySummary | WhoopDailySummary,
  connectionId: string,
  studentId: string,
): Promise<BiometricAggregateRow> {
  if (provider === "oura") {
    const d = data as OuraDailySummary;
    const periodStart = d.day;
    const sleepQualityScore = numericOrNull(d.score);
    const hrvMs = numericOrNull(d.hrv_avg);
    const restingHrBpm = numericOrNull(d.resting_heart_rate);
    const sourceHash = await hashStructured({
      provider,
      period_start: periodStart,
      sleep_duration_minutes: null,
      sleep_quality_score: sleepQualityScore,
      hrv_ms: hrvMs,
      resting_hr_bpm: restingHrBpm,
      daily_readiness_score: null,
    });
    return {
      connection_id: connectionId,
      student_id: studentId,
      provider,
      period_type: "daily",
      period_start: periodStart,
      sleep_duration_minutes: null,
      sleep_quality_score: sleepQualityScore,
      hrv_ms: hrvMs,
      resting_hr_bpm: restingHrBpm,
      daily_readiness_score: null,
      source_hash: sourceHash,
    };
  }

  if (provider === "whoop") {
    const d = data as WhoopDailySummary;
    const periodStart = d.cycle_start.slice(0, 10);
    const sleepDurationMinutes = numericOrNull(d.sleep_duration_min);
    const dailyReadinessScore = numericOrNull(d.recovery_score);
    const hrvMs = numericOrNull(d.hrv_ms);
    const restingHrBpm = numericOrNull(d.resting_heart_rate);
    const sourceHash = await hashStructured({
      provider,
      period_start: periodStart,
      sleep_duration_minutes: sleepDurationMinutes,
      sleep_quality_score: null,
      hrv_ms: hrvMs,
      resting_hr_bpm: restingHrBpm,
      daily_readiness_score: dailyReadinessScore,
    });
    return {
      connection_id: connectionId,
      student_id: studentId,
      provider,
      period_type: "daily",
      period_start: periodStart,
      sleep_duration_minutes: sleepDurationMinutes,
      sleep_quality_score: null,
      hrv_ms: hrvMs,
      resting_hr_bpm: restingHrBpm,
      daily_readiness_score: dailyReadinessScore,
      source_hash: sourceHash,
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ----- correlator ----------------------------------------------------------

function computeWeights(
  hasBiometric: boolean,
  hasDetector: boolean,
): SourceMix {
  if (hasBiometric && hasDetector) {
    return { biometric: 0.4, ide: 0, "002_detector": 0.6 };
  }
  if (hasBiometric) {
    return { biometric: 1.0, ide: 0, "002_detector": 0 };
  }
  return { biometric: 0, ide: 0, "002_detector": 1.0 };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

function biometricConfidence(biometrics: BiometricAggregateRow[]): number {
  if (biometrics.length === 0) return 0;
  const scores: number[] = [];
  for (const b of biometrics) {
    if (typeof b.sleep_quality_score === "number") {
      scores.push(clamp01(b.sleep_quality_score / 100));
    }
    if (typeof b.daily_readiness_score === "number") {
      scores.push(clamp01(b.daily_readiness_score / 100));
    }
  }
  if (scores.length === 0) return 0.5;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function ideConfidence(ide: IDEAggregateRow | null): number {
  if (!ide) return 0;
  return clamp01(ide.score_contribution / IDE_SCORE_CAP);
}

async function correlate(
  studentId: string,
  biometrics: BiometricAggregateRow[],
  ideAggregate: IDEAggregateRow | null,
  detectorOutput: DetectorOutput | null,
): Promise<PeakWindowInferenceRow> {
  const hasBiometric = biometrics.length > 0;
  const hasDetector = detectorOutput !== null;
  const weights = computeWeights(hasBiometric, hasDetector);

  let windowStart: string;
  let windowEnd: string;
  if (detectorOutput) {
    windowStart = detectorOutput.window_start;
    windowEnd = detectorOutput.window_end;
  } else if (biometrics.length > 0) {
    const sorted = [...biometrics].sort((a, b) => a.period_start.localeCompare(b.period_start));
    const earliest = sorted[0].period_start;
    const start = new Date(`${earliest.slice(0, 10)}T00:00:00.000Z`);
    windowStart = start.toISOString();
    windowEnd = new Date(start.getTime() + 86400000).toISOString();
  } else if (ideAggregate) {
    const start = new Date(`${ideAggregate.period_start.slice(0, 10)}T00:00:00.000Z`);
    windowStart = start.toISOString();
    windowEnd = new Date(start.getTime() + 86400000).toISOString();
  } else {
    const now = new Date();
    windowStart = now.toISOString();
    windowEnd = new Date(now.getTime() + 86400000).toISOString();
  }

  const bioConf = biometricConfidence(biometrics);
  const ideConf = ideConfidence(ideAggregate);
  const detConf = hasDetector ? clamp01(detectorOutput!.confidence) : 0;

  const rawConfidence =
    weights.biometric * bioConf +
    weights.ide * ideConf +
    weights["002_detector"] * detConf;
  const confidence = clamp01(Math.min(rawConfidence, CONFIDENCE_MAX));

  const biometricInputsHash = hasBiometric
    ? await hashStructured(
        biometrics.map((b) => ({
          period_start: b.period_start,
          sleep: b.sleep_duration_minutes ?? null,
          hrv: b.hrv_ms ?? null,
          rhr: b.resting_hr_bpm ?? null,
        })),
      )
    : null;
  const ideInputsHash = ideAggregate
    ? await hashStructured(ideAggregate)
    : null;
  const detectorInputsHash = await hashStructured(detectorOutput ?? {});

  return {
    student_id: studentId,
    window_start: windowStart,
    window_end: windowEnd,
    confidence,
    biometric_inputs_hash: biometricInputsHash,
    ide_inputs_hash: ideInputsHash,
    detector_inputs_hash: detectorInputsHash,
    source_mix: weights as unknown as Record<string, number>,
  };
}

// ----- data access ---------------------------------------------------------

async function loadActiveConnections(): Promise<BiometricConnectionRow[]> {
  const { data, error } = await supabase
    .from("biometric_connections")
    .select("*")
    .eq("status", "connected")
    .or("last_error.is.null,last_error.eq.");
  if (error) throw new Error(`loadActiveConnections: ${error.message}`);
  return (data ?? []) as BiometricConnectionRow[];
}

async function upsertBiometricAggregate(
  row: BiometricAggregateRow,
): Promise<void> {
  const { error } = await supabase
    .from("biometric_aggregates")
    .upsert(row, {
      onConflict: "connection_id, period_type, period_start",
      ignoreDuplicates: false,
    });
  if (error) throw new Error(`upsertBiometricAggregate: ${error.message}`);
}

async function latestPeakWindowTime(
  studentId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("peak_window_inferences")
    .select("created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`latestPeakWindowTime: ${error.message}`);
  if (!data || data.length === 0) return null;
  return (data[0] as { created_at: string }).created_at;
}

async function latestIDEAggregate(
  studentId: string,
): Promise<IDEAggregateRow | null> {
  const { data, error } = await supabase
    .from("ide_aggregates")
    .select("*")
    .eq("student_id", studentId)
    .order("period_start", { ascending: false })
    .limit(1);
  if (error) throw new Error(`latestIDEAggregate: ${error.message}`);
  if (!data || data.length === 0) return null;
  return data[0] as IDEAggregateRow;
}

async function latestDetectorOutput(
  studentId: string,
): Promise<DetectorOutput | null> {
  const { data, error } = await supabase
    .from("peak_window_inferences")
    .select("window_start, window_end, confidence")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`latestDetectorOutput: ${error.message}`);
  if (!data || data.length === 0) return null;
  return data[0] as DetectorOutput;
}

async function upsertPeakWindowInference(
  row: PeakWindowInferenceRow,
): Promise<void> {
  const { error } = await supabase
    .from("peak_window_inferences")
    .insert({
      student_id: row.student_id,
      window_start: row.window_start,
      window_end: row.window_end,
      confidence: row.confidence,
      biometric_inputs_hash: row.biometric_inputs_hash,
      ide_inputs_hash: row.ide_inputs_hash,
      detector_inputs_hash: row.detector_inputs_hash,
      source_mix: row.source_mix,
    });
  if (error) throw new Error(`upsertPeakWindowInference: ${error.message}`);
}

async function updateConnectionSync(
  connectionId: string,
  lastSyncAt: string,
): Promise<void> {
  const { error } = await supabase
    .from("biometric_connections")
    .update({ last_sync_at: lastSyncAt, last_error: null })
    .eq("id", connectionId);
  if (error) throw new Error(`updateConnectionSync: ${error.message}`);
}

async function updateConnectionRefreshToken(
  connectionId: string,
  encryptedToken: string,
): Promise<void> {
  const { error } = await supabase
    .from("biometric_connections")
    .update({ oauth_refresh_token_encrypted: encryptedToken })
    .eq("id", connectionId);
  if (error) throw new Error(`updateConnectionRefreshToken: ${error.message}`);
}

async function markConnectionExpired(
  connectionId: string,
  errorMsg: string,
): Promise<void> {
  const truncated = errorMsg.slice(0, 500);
  const { error } = await supabase
    .from("biometric_connections")
    .update({ status: "expired", last_error: truncated })
    .eq("id", connectionId);
  if (error) throw new Error(`markConnectionExpired: ${error.message}`);
}

async function updateConnectionError(
  connectionId: string,
  errorMsg: string,
): Promise<void> {
  const truncated = errorMsg.slice(0, 500);
  const { error } = await supabase
    .from("biometric_connections")
    .update({ last_error: truncated })
    .eq("id", connectionId);
  if (error) throw new Error(`updateConnectionError: ${error.message}`);
}

// ----- audit ---------------------------------------------------------------

async function writeSignalAudit(
  studentId: string,
  provider: string,
  action: string,
  byteCount: number,
  aggregateHash: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("signal_audit")
    .insert({
      actor_id: null,
      actor_type: "system",
      student_id: studentId,
      provider,
      action,
      byte_count: byteCount,
      aggregate_hash: aggregateHash,
      payload_redacted: true,
    });
  if (error) console.error("writeSignalAudit failed", error.message);
}

// ----- per-connection processor --------------------------------------------

interface ConnectionResult {
  connection_id: string;
  student_id: string;
  provider: string;
  ok: boolean;
  aggregates_written: number;
  peak_window_written: boolean;
  error?: string;
}

async function processConnection(
  conn: BiometricConnectionRow,
): Promise<ConnectionResult> {
  const result: ConnectionResult = {
    connection_id: conn.id,
    student_id: conn.student_id,
    provider: conn.provider,
    ok: false,
    aggregates_written: 0,
    peak_window_written: false,
  };

  try {
    if (!conn.oauth_refresh_token_encrypted) {
      throw new Error("No refresh token stored for this connection");
    }

    const refreshToken = await decryptSecret(conn.oauth_refresh_token_encrypted);

    // Get a fresh access_token from the refresh_token
    let accessToken: string;
    try {
      const tokenResult = await refreshProviderToken(conn.provider, refreshToken);
      accessToken = tokenResult.access_token;
      if (tokenResult.new_refresh_token && tokenResult.new_refresh_token !== refreshToken) {
        const encrypted = await encryptSecret(tokenResult.new_refresh_token);
        await updateConnectionRefreshToken(conn.id, encrypted);
        console.log("refresh-token-rotated", {
          connection_id: conn.id,
          provider: conn.provider,
        });
      }
    } catch (e) {
      const msg = (e as Error).message;
      await markConnectionExpired(conn.id, msg);
      result.error = msg;
      return result;
    }

    // Fetch provider data
    await rateLimitProvider(conn.provider);

    let summaries: (OuraDailySummary | WhoopDailySummary)[] = [];
    try {
      if (conn.provider === "oura") {
        const today = new Date().toISOString().slice(0, 10);
        summaries = await fetchOuraDaily(accessToken, today);
      } else if (conn.provider === "whoop") {
        const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
          .toISOString().slice(0, 10);
        summaries = await fetchWhoopDaily(accessToken, threeDaysAgo);
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("401")) {
        // Token might be stale; try one more refresh + retry
        try {
          const tokenResult = await refreshProviderToken(conn.provider, refreshToken);
          accessToken = tokenResult.access_token;
          if (tokenResult.new_refresh_token && tokenResult.new_refresh_token !== refreshToken) {
            const encrypted = await encryptSecret(tokenResult.new_refresh_token);
            await updateConnectionRefreshToken(conn.id, encrypted);
            console.log("refresh-token-rotated-on-401", {
              connection_id: conn.id,
              provider: conn.provider,
            });
          }

          await rateLimitProvider(conn.provider);
          if (conn.provider === "oura") {
            const today = new Date().toISOString().slice(0, 10);
            summaries = await fetchOuraDaily(accessToken, today);
          } else if (conn.provider === "whoop") {
            const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
              .toISOString().slice(0, 10);
            summaries = await fetchWhoopDaily(accessToken, threeDaysAgo);
          }
        } catch (retryErr) {
          const retryMsg = (retryErr as Error).message;
          await markConnectionExpired(conn.id, retryMsg);
          result.error = retryMsg;
          return result;
        }
      } else {
        // Non-401 error, update connection error
        await updateConnectionError(conn.id, msg);
        result.error = msg;
        return result;
      }
    }

    if (summaries.length === 0) {
      console.log("no-provider-data", {
        connection_id: conn.id,
        provider: conn.provider,
      });
      const now = new Date().toISOString();
      await updateConnectionSync(conn.id, now);
      result.ok = true;
      return result;
    }

    // Aggregate and upsert each daily summary
    const aggregateRows: BiometricAggregateRow[] = [];
    for (const summary of summaries) {
      const row = await aggregateDaily(conn.provider, summary, conn.id, conn.student_id);
      await upsertBiometricAggregate(row);
      aggregateRows.push(row);
      result.aggregates_written += 1;

      // Write signal_audit for this aggregate
      const byteCount = stableStringify(row).length;
      await writeSignalAudit(
        conn.student_id,
        `biometric_${conn.provider}`,
        "upload",
        byteCount,
        row.source_hash,
      );
    }

    const now = new Date().toISOString();
    await updateConnectionSync(conn.id, now);

    // Check if peak_window_inferences is stale (> 24h old)
    const lastPeakTime = await latestPeakWindowTime(conn.student_id);
    const shouldCorrelate = !lastPeakTime ||
      (Date.now() - new Date(lastPeakTime).getTime() > 86400000);

    if (shouldCorrelate) {
      const latestIde = await latestIDEAggregate(conn.student_id);
      const detectorOutput = await latestDetectorOutput(conn.student_id);
      const inference = await correlate(
        conn.student_id,
        aggregateRows,
        latestIde,
        detectorOutput,
      );
      await upsertPeakWindowInference(inference);

      const inferenceByteCount = stableStringify(inference).length;
      await writeSignalAudit(
        conn.student_id,
        "privacy_center",
        "upload",
        inferenceByteCount,
        inference.detector_inputs_hash,
      );

      result.peak_window_written = true;
    }

    result.ok = true;
    return result;
  } catch (e) {
    const msg = (e as Error).message;
    result.error = msg;
    return result;
  }
}

// ----- handler -------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as {
    student_id?: string;
    sweep?: boolean;
  };

  try {
    if (body.student_id) {
      // Single-student mode (debug / manual trigger)
      const { data: conns, error } = await supabase
        .from("biometric_connections")
        .select("*")
        .eq("student_id", body.student_id)
        .eq("status", "connected")
        .or("last_error.is.null,last_error.eq.");
      if (error) throw new Error(`single-student query: ${error.message}`);

      const results: ConnectionResult[] = [];
      for (const conn of (conns ?? []) as BiometricConnectionRow[]) {
        const r = await processConnection(conn);
        results.push(r);
      }

      return json({
        ok: true,
        student_id: body.student_id,
        connections: results.length,
        results,
      });
    }

    // Sweep mode (nightly cron)
    const connections = await loadActiveConnections();
    console.log("correlator-sweep-start", { totalConnections: connections.length });

    const results: ConnectionResult[] = [];
    let totalAggregates = 0;
    let totalPeakWindows = 0;
    let failures = 0;

    for (const conn of connections) {
      const r = await processConnection(conn);
      results.push(r);
      totalAggregates += r.aggregates_written;
      if (r.peak_window_written) totalPeakWindows += 1;
      if (!r.ok) failures += 1;
    }

    console.log("correlator-sweep-end", {
      connections: connections.length,
      aggregatesWritten: totalAggregates,
      peakWindowsWritten: totalPeakWindows,
      failures,
    });

    return json({
      ok: true,
      connections_processed: connections.length,
      aggregates_written: totalAggregates,
      peak_windows_written: totalPeakWindows,
      failures,
      results,
    });
  } catch (e) {
    console.error("biometric-correlator handler failed", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
