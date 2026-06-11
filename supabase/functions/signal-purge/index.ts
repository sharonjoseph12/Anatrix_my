// supabase/functions/signal-purge/index.ts
//
// spec: specs/006-deep-signal-capture/spec.md FR-IDE-005, FR-BIO-006, FR-AUD-003, FR-PRI-003
// data-model: specs/006-deep-signal-capture/data-model.md lines 122-348
//
// Nightly cron (triggered by Supabase Schedule or 038_cron_*):
//   1. Roll up ide_sessions older than PRIVACY_TTL_IDE_DAYS (default 30) into
//      ide_aggregates (period_type='monthly'), then DELETE the raw rows.
//   2. Roll up daily biometric_aggregates older than PRIVACY_TTL_BIOMETRIC_DAYS
//      (default 90) into monthly rows, then DELETE the raw daily rows.
//   3. Purge peak_window_inferences older than PRIVACY_TTL_PEAK_WINDOW_DAYS
//      (default 30).
//   4. Process pending dpdp_erasure_requests whose due_by <= now():
//      DELETE all signal data for the student, mark the request complete,
//      write a terminal signal_audit row.
//   5. Write signal_audit rows for each batch of deletions.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PRIVACY_TTL_IDE_DAYS = Number(Deno.env.get("PRIVACY_TTL_IDE_DAYS") ?? "30");
const PRIVACY_TTL_BIOMETRIC_DAYS = Number(Deno.env.get("PRIVACY_TTL_BIOMETRIC_DAYS") ?? "90");
const PRIVACY_TTL_PEAK_WINDOW_DAYS = Number(Deno.env.get("PRIVACY_TTL_PEAK_WINDOW_DAYS") ?? "30");
const SELECT_BATCH_SIZE = 500;
const DELETE_BATCH_SIZE = 100;
const AUDIT_BATCH_INTERVAL = 25;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface HealthCheckResult {
  step: string;
  ide_sessions_rolled: number;
  biometric_aggregates_rolled: number;
  peak_window_purged: number;
  erasure_requests_processed: number;
  audit_rows_written: number;
}

async function rollUpIdeSessions(
  cutoff: Date,
  auditBuffer: Array<{ student_id: string; byte_count: number }>,
): Promise<{ rolled: number; audit: Array<{ student_id: string; byte_count: number }> }> {
  let rolled = 0;
  let lastId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const query = supabase
      .from("ide_sessions")
      .select("id, device_id, student_id, duration_seconds, language, uploaded_at, keystroke_entropy_bpm, debug_session_duration_seconds, debug_step_ratio, ast_refactor_distance, time_in_file_seconds, test_run_count, error_resolution_latency_ms, raw_partial_capture")
      .lt("uploaded_at", cutoff.toISOString())
      .order("id", { ascending: true })
      .limit(SELECT_BATCH_SIZE);

    if (lastId) query.gt("id", lastId);

    const { data: rows, error } = await query;
    if (error) throw new Error(`rollUpIdeSessions select: ${error.message}`);
    if (!rows || rows.length === 0) break;

    lastId = rows[rows.length - 1].id;
    hasMore = rows.length === SELECT_BATCH_SIZE;

    const grouped = new Map<string, {
      student_id: string;
      device_id: string;
      period_start: string;
      session_count: number;
      total_active_seconds: number;
      language_breakdown: Record<string, number>;
      sum_keystroke_entropy: number;
      sum_debug_session_duration: number;
      sum_debug_step_ratio: number;
      sum_ast_refactor_distance: number;
      sum_time_in_file: number;
      sum_test_run_count: number;
      sum_error_resolution_latency: number;
      row_count: number;
    }>();

    for (const r of rows) {
      const periodStart = firstOfMonth(new Date(r.uploaded_at));
      const key = `${r.student_id}|${r.device_id}|${periodStart}`;
      const g = grouped.get(key) ?? {
        student_id: r.student_id,
        device_id: r.device_id,
        period_start: periodStart,
        session_count: 0,
        total_active_seconds: 0,
        language_breakdown: {},
        sum_keystroke_entropy: 0,
        sum_debug_session_duration: 0,
        sum_debug_step_ratio: 0,
        sum_ast_refactor_distance: 0,
        sum_time_in_file: 0,
        sum_test_run_count: 0,
        sum_error_resolution_latency: 0,
        row_count: 0,
      };
      g.session_count += 1;
      g.total_active_seconds += r.duration_seconds;
      g.language_breakdown[r.language] = (g.language_breakdown[r.language] ?? 0) + 1;
      g.sum_keystroke_entropy += Number(r.keystroke_entropy_bpm);
      g.sum_debug_session_duration += r.debug_session_duration_seconds;
      g.sum_debug_step_ratio += Number(r.debug_step_ratio);
      g.sum_ast_refactor_distance += r.ast_refactor_distance;
      g.sum_time_in_file += r.time_in_file_seconds;
      g.sum_test_run_count += r.test_run_count;
      g.sum_error_resolution_latency += r.error_resolution_latency_ms;
      g.row_count += 1;
      grouped.set(key, g);
    }

    const inserts: Array<Record<string, unknown>> = [];
    for (const g of grouped.values()) {
      const n = g.row_count;
      const langEntries = Object.entries(g.language_breakdown).map(
        ([lang, count]) => [lang, count / n] as [string, number],
      );
      const languageBreakdown: Record<string, number> = {};
      for (const [lang, share] of langEntries) {
        languageBreakdown[lang] = Math.round(share * 100) / 100;
      }

      inserts.push({
        device_id: g.device_id,
        student_id: g.student_id,
        day: g.period_start,
        session_count: g.session_count,
        total_active_seconds: g.total_active_seconds,
        language_breakdown_json: languageBreakdown,
        productivity_score_raw: 0,
        score_contribution: 0,
        period_type: "monthly",
        period_start: g.period_start,
        computed_at: new Date().toISOString(),
      });
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from("ide_aggregates").insert(inserts);
      if (insErr) throw new Error(`rollUpIdeSessions insert aggregates: ${insErr.message}`);
    }

    const ids = rows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
      const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
      const { error: delErr } = await supabase
        .from("ide_sessions")
        .delete()
        .in("id", batch);
      if (delErr) throw new Error(`rollUpIdeSessions delete: ${delErr.message}`);
    }

    rolled += rows.length;

    const countByStudent = new Map<string, number>();
    for (const r of rows) {
      countByStudent.set(r.student_id, (countByStudent.get(r.student_id) ?? 0) + 1);
    }
    for (const [studentId, cnt] of countByStudent) {
      auditBuffer.push({ student_id: studentId, byte_count: cnt });
    }
  }

  return { rolled, audit: auditBuffer };
}

interface BiometricGroup {
  student_id: string;
  connection_id: string;
  provider: string;
  period_start: string;
  sum_sleep_duration_minutes: number;
  sum_sleep_quality_score: number;
  sum_hrv_ms: number;
  sum_resting_hr_bpm: number;
  sum_daily_readiness_score: number;
  null_sleep_duration: number;
  null_sleep_quality: number;
  null_hrv: number;
  null_resting_hr: number;
  null_readiness: number;
  row_count: number;
}

async function rollUpBiometricAggregates(
  cutoff: Date,
  auditBuffer: Array<{ student_id: string; byte_count: number }>,
): Promise<{ rolled: number; audit: Array<{ student_id: string; byte_count: number }> }> {
  let rolled = 0;
  let lastId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const query = supabase
      .from("biometric_aggregates")
      .select("id, connection_id, student_id, provider, period_start, sleep_duration_minutes, sleep_quality_score, hrv_ms, resting_hr_bpm, daily_readiness_score")
      .eq("period_type", "daily")
      .lt("period_start", isoDate(cutoff))
      .order("id", { ascending: true })
      .limit(SELECT_BATCH_SIZE);

    if (lastId) query.gt("id", lastId);

    const { data: rows, error } = await query;
    if (error) throw new Error(`rollUpBiometricAggregates select: ${error.message}`);
    if (!rows || rows.length === 0) break;

    lastId = rows[rows.length - 1].id;
    hasMore = rows.length === SELECT_BATCH_SIZE;

    const grouped = new Map<string, BiometricGroup>();

    for (const r of rows) {
      const d = new Date(r.period_start);
      const periodStart = firstOfMonth(d);
      const key = `${r.student_id}|${r.connection_id}|${r.provider}|${periodStart}`;
      const g = grouped.get(key) ?? {
        student_id: r.student_id,
        connection_id: r.connection_id,
        provider: r.provider,
        period_start: periodStart,
        sum_sleep_duration_minutes: 0,
        sum_sleep_quality_score: 0,
        sum_hrv_ms: 0,
        sum_resting_hr_bpm: 0,
        sum_daily_readiness_score: 0,
        null_sleep_duration: 0,
        null_sleep_quality: 0,
        null_hrv: 0,
        null_resting_hr: 0,
        null_readiness: 0,
        row_count: 0,
      };
      g.row_count += 1;
      if (r.sleep_duration_minutes !== null) g.sum_sleep_duration_minutes += r.sleep_duration_minutes;
      else g.null_sleep_duration += 1;
      if (r.sleep_quality_score !== null) g.sum_sleep_quality_score += r.sleep_quality_score;
      else g.null_sleep_quality += 1;
      if (r.hrv_ms !== null) g.sum_hrv_ms += r.hrv_ms;
      else g.null_hrv += 1;
      if (r.resting_hr_bpm !== null) g.sum_resting_hr_bpm += r.resting_hr_bpm;
      else g.null_resting_hr += 1;
      if (r.daily_readiness_score !== null) g.sum_daily_readiness_score += r.daily_readiness_score;
      else g.null_readiness += 1;
      grouped.set(key, g);
    }

    const inserts: Array<Record<string, unknown>> = [];
    for (const g of grouped.values()) {
      const n = g.row_count;
      const nonNullSleepDuration = n - g.null_sleep_duration;
      const nonNullSleepQuality = n - g.null_sleep_quality;
      const nonNullHrv = n - g.null_hrv;
      const nonNullRestingHr = n - g.null_resting_hr;
      const nonNullReadiness = n - g.null_readiness;

      const row: Record<string, unknown> = {
        connection_id: g.connection_id,
        student_id: g.student_id,
        provider: g.provider,
        period_type: "monthly",
        period_start: g.period_start,
        sleep_duration_minutes: nonNullSleepDuration > 0 ? Math.round(g.sum_sleep_duration_minutes / nonNullSleepDuration) : null,
        sleep_quality_score: nonNullSleepQuality > 0 ? Math.round(g.sum_sleep_quality_score / nonNullSleepQuality) : null,
        hrv_ms: nonNullHrv > 0 ? Math.round(g.sum_hrv_ms / nonNullHrv) : null,
        resting_hr_bpm: nonNullRestingHr > 0 ? Math.round(g.sum_resting_hr_bpm / nonNullRestingHr) : null,
        daily_readiness_score: nonNullReadiness > 0 ? Math.round(g.sum_daily_readiness_score / nonNullReadiness) : null,
      };

      const sourceInput = `${g.provider}|${g.period_start}|${row.sleep_duration_minutes}|${row.sleep_quality_score}|${row.hrv_ms}|${row.resting_hr_bpm}|${row.daily_readiness_score}`;
      row.source_hash = await sha256Hex(sourceInput);

      inserts.push(row);
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from("biometric_aggregates").insert(inserts);
      if (insErr) throw new Error(`rollUpBiometricAggregates insert: ${insErr.message}`);
    }

    const ids = rows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
      const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
      const { error: delErr } = await supabase
        .from("biometric_aggregates")
        .delete()
        .in("id", batch);
      if (delErr) throw new Error(`rollUpBiometricAggregates delete: ${delErr.message}`);
    }

    rolled += rows.length;

    const countByStudent = new Map<string, number>();
    for (const r of rows) {
      countByStudent.set(r.student_id, (countByStudent.get(r.student_id) ?? 0) + 1);
    }
    for (const [studentId, cnt] of countByStudent) {
      auditBuffer.push({ student_id: studentId, byte_count: cnt });
    }
  }

  return { rolled, audit: auditBuffer };
}

async function purgePeakWindowInferences(cutoff: Date): Promise<number> {
  let totalPurged = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: rows, error } = await supabase
      .from("peak_window_inferences")
      .select("id")
      .lt("created_at", cutoff.toISOString())
      .order("id", { ascending: true })
      .limit(DELETE_BATCH_SIZE);

    if (error) throw new Error(`purgePeakWindowInferences select: ${error.message}`);
    if (!rows || rows.length === 0) break;

    const ids = rows.map((r) => r.id);
    const { error: delErr } = await supabase
      .from("peak_window_inferences")
      .delete()
      .in("id", ids);

    if (delErr) throw new Error(`purgePeakWindowInferences delete: ${delErr.message}`);

    totalPurged += rows.length;
    hasMore = rows.length === DELETE_BATCH_SIZE;
  }

  return totalPurged;
}

async function processErasureRequests(
  auditBuffer: Array<{ student_id: string; byte_count: number }>,
): Promise<{ processed: number; audit: Array<{ student_id: string; byte_count: number }> }> {
  let processed = 0;

  const { data: requests, error: reqErr } = await supabase
    .from("dpdp_erasure_requests")
    .select("id, student_id")
    .eq("status", "pending")
    .lte("due_by", new Date().toISOString())
    .limit(SELECT_BATCH_SIZE);

  if (reqErr) throw new Error(`processErasureRequests select: ${reqErr.message}`);
  if (!requests || requests.length === 0) return { processed: 0, audit: auditBuffer };

  for (const req of requests) {
    const { error: err1 } = await supabase
      .from("ide_sessions")
      .delete()
      .eq("student_id", req.student_id);
    if (err1) throw new Error(`erasure ide_sessions delete ${req.student_id}: ${err1.message}`);

    const { error: err2 } = await supabase
      .from("ide_aggregates")
      .delete()
      .eq("student_id", req.student_id);
    if (err2) throw new Error(`erasure ide_aggregates delete ${req.student_id}: ${err2.message}`);

    const { error: err3 } = await supabase
      .from("biometric_connections")
      .delete()
      .eq("student_id", req.student_id);
    if (err3) throw new Error(`erasure biometric_connections delete ${req.student_id}: ${err3.message}`);

    const { error: err4 } = await supabase
      .from("biometric_aggregates")
      .delete()
      .eq("student_id", req.student_id);
    if (err4) throw new Error(`erasure biometric_aggregates delete ${req.student_id}: ${err4.message}`);

    const { error: err5 } = await supabase
      .from("peak_window_inferences")
      .delete()
      .eq("student_id", req.student_id);
    if (err5) throw new Error(`erasure peak_window_inferences delete ${req.student_id}: ${err5.message}`);

    const { error: updErr } = await supabase
      .from("dpdp_erasure_requests")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", req.id);
    if (updErr) throw new Error(`erasure update status ${req.student_id}: ${updErr.message}`);

    auditBuffer.push({ student_id: req.student_id, byte_count: 0 });
    processed += 1;
  }

  return { processed, audit: auditBuffer };
}

async function flushAuditBuffer(buffer: Array<{ student_id: string; byte_count: number }>): Promise<number> {
  let written = 0;

  for (let i = 0; i < buffer.length; i += AUDIT_BATCH_INTERVAL) {
    const batch = buffer.slice(i, i + AUDIT_BATCH_INTERVAL);
    const now = new Date().toISOString();
    const rows = batch.map((b) => ({
      actor_id: null,
      actor_type: "system" as const,
      student_id: b.student_id,
      provider: "privacy_center" as const,
      action: b.byte_count > 0 ? "delete_one" as const : "erasure_complete" as const,
      byte_count: b.byte_count,
      aggregate_hash: null,
      payload_redacted: true,
      created_at: now,
    }));

    const { error } = await supabase.from("signal_audit").insert(rows);
    if (error) throw new Error(`flushAuditBuffer insert: ${error.message}`);
    written += rows.length;
  }

  return written;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  try {
    const auditBuffer: Array<{ student_id: string; byte_count: number }> = [];

    const ideCutoff = new Date(Date.now() - PRIVACY_TTL_IDE_DAYS * 86400000);
    const bioCutoff = new Date(Date.now() - PRIVACY_TTL_BIOMETRIC_DAYS * 86400000);
    const peakCutoff = new Date(Date.now() - PRIVACY_TTL_PEAK_WINDOW_DAYS * 86400000);

    const { rolled: ideRolled } = await rollUpIdeSessions(ideCutoff, auditBuffer);
    const { rolled: bioRolled } = await rollUpBiometricAggregates(bioCutoff, auditBuffer);
    const peakPurged = await purgePeakWindowInferences(peakCutoff);
    const { processed: erasureProcessed } = await processErasureRequests(auditBuffer);
    const auditWritten = await flushAuditBuffer(auditBuffer);

    const result: HealthCheckResult = {
      step: "signal-purge",
      ide_sessions_rolled: ideRolled,
      biometric_aggregates_rolled: bioRolled,
      peak_window_purged: peakPurged,
      erasure_requests_processed: erasureProcessed,
      audit_rows_written: auditWritten,
    };

    console.log("signal-purge complete", result);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("signal-purge failed", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
