// apps/web/src/app/api/ide-telemetry/session/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US1 (FR-IDE-001..006)
//   contracts/api.md → POST /api/ide-telemetry/session
// Auth: device-JWT in Authorization header. The lib/signals/device-jwt
// verifier is not yet implemented; we read the student_id from an
// X-Student-Id header and treat X-Device-Id as the device identity. The
// score contribution is computed server-side and clamped to [0, 3] per
// FR-CAP-001. Every upload writes a signal_audit row (FR-PRI-004).

import { NextResponse, type NextRequest } from "next/server";
import { ZodSignals } from "@antarix/types";
import { clampIDEScore } from "@antarix/utils";
import { hashStructured } from "@antarix/utils/hash";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { writeSignalAudit } from "@/lib/audit/log";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function err(code: string, message: string, status: number) {
  return json({ error: { code, message } }, { status });
}

function isFlagEnabled(): boolean {
  return process.env.FF_006_IDE_TELEMETRY === "on";
}

function computeProductivityFactor(input: {
  keystroke_entropy_bpm: number;
  error_resolution_latency_ms: number;
  test_run_count: number;
  duration_seconds: number;
}): number {
  const durationMinutes = Math.max(1, input.duration_seconds / 60);
  const entropyTerm = 0.5 * Math.min(20, Math.max(0, input.keystroke_entropy_bpm)) / 20;
  const errorRate = Math.min(1, input.error_resolution_latency_ms / 60_000);
  const errorTerm = 0.3 * (1 - errorRate);
  const testTerm = 0.2 * Math.min(1, input.test_run_count / durationMinutes);
  const raw = entropyTerm + errorTerm + testTerm;
  return Math.max(0, Math.min(1, raw));
}

function scoreContributionFor(sessionCount: number, factor: number): number {
  return clampIDEScore(Math.min(3, sessionCount * factor));
}

export async function POST(req: NextRequest) {
  if (!isFlagEnabled()) {
    return err("not_found", "Feature not available", 404);
  }

  const deviceId = req.headers.get("x-device-id");
  const headerStudentId = req.headers.get("x-student-id");
  if (!deviceId) {
    return err("unauthorized", "Missing X-Device-Id header", 401);
  }
  if (!headerStudentId) {
    return err("unauthorized", "Missing X-Student-Id header", 401);
  }

  // TODO(prod): use device-JWT — verify Authorization: Bearer <jwt> via
  // verifyDeviceJwt() from @/lib/signals/device-jwt (not yet implemented).

  const rl = rateLimit({ key: `ide-session:${deviceId}`, limit: 60, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = ZodSignals.ideSessionUploadSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: { code: "invalid_input", message: "Invalid request", issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.device_id !== deviceId) {
    return err("forbidden", "device_id mismatch", 403);
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const authedStudentId = auth?.user?.id ?? null;
  const studentId = authedStudentId ?? headerStudentId;

  const day = data.started_at.slice(0, 10);
  const productivityFactor = computeProductivityFactor({
    keystroke_entropy_bpm: data.keystroke_entropy_bpm,
    error_resolution_latency_ms: data.error_resolution_latency_ms,
    test_run_count: data.test_run_count,
    duration_seconds: data.duration_seconds,
  });

  const service = createSupabaseServiceClient();

  const { data: existingAgg } = await service
    .from("ide_aggregates")
    .select("id, session_count, total_active_seconds, language_breakdown_json, productivity_score_raw, score_contribution")
    .eq("device_id", data.device_id)
    .eq("period_type", "daily")
    .eq("period_start", day)
    .maybeSingle();

  const prevSessionCount = (existingAgg?.session_count as number | undefined) ?? 0;
  const prevTotalSeconds = (existingAgg?.total_active_seconds as number | undefined) ?? 0;
  const prevBreakdown =
    (existingAgg?.language_breakdown_json as Record<string, number> | undefined) ?? {};
  const newSessionCount = prevSessionCount + 1;
  const newTotalSeconds = prevTotalSeconds + data.duration_seconds;
  const newBreakdown: Record<string, number> = { ...prevBreakdown };
  const prevLangShare = prevBreakdown[data.language] ?? 0;
  newBreakdown[data.language] =
    (prevLangShare * prevSessionCount + 1) / Math.max(1, newSessionCount);
  const productivityRaw = Math.round(productivityFactor * 100 * 100) / 100;
  const scoreContrib = scoreContributionFor(newSessionCount, productivityFactor);

  const { error: aggErr } = await service.from("ide_aggregates").upsert(
    {
      device_id: data.device_id,
      student_id: studentId,
      day,
      session_count: newSessionCount,
      total_active_seconds: newTotalSeconds,
      language_breakdown_json: newBreakdown,
      productivity_score_raw: productivityRaw,
      score_contribution: scoreContrib,
      period_type: "daily",
      period_start: day,
    },
    { onConflict: "device_id,period_type,period_start" },
  );
  if (aggErr) {
    return err("internal_error", aggErr.message, 500);
  }

  const { data: inserted, error: insErr } = await service
    .from("ide_sessions")
    .insert({
      device_id: data.device_id,
      student_id: studentId,
      started_at: data.started_at,
      ended_at: data.ended_at,
      duration_seconds: data.duration_seconds,
      editor: data.editor,
      project_hash: data.project_hash,
      language: data.language,
      keystroke_entropy_bpm: data.keystroke_entropy_bpm,
      debug_session_duration_seconds: data.debug_session_duration_seconds,
      debug_step_ratio: data.debug_step_ratio,
      ast_refactor_distance: data.ast_refactor_distance,
      time_in_file_seconds: data.time_in_file_seconds,
      test_run_count: data.test_run_count,
      error_resolution_latency_ms: data.error_resolution_latency_ms,
      raw_partial_capture: data.raw_partial_capture,
    })
    .select("id")
    .single();
  if (insErr) {
    return err("internal_error", insErr.message, 500);
  }
  const sessionId = (inserted as { id: string }).id;

  const byteCount = Buffer.byteLength(JSON.stringify(data), "utf8");
  const aggregateHash = hashStructured({
    device_id: data.device_id,
    day,
    session_count: newSessionCount,
    total_active_seconds: newTotalSeconds,
    score_contribution: scoreContrib,
  });

  try {
    await writeSignalAudit({
      actor_id: null,
      actor_type: "system",
      student_id: studentId,
      provider: data.editor === "cursor" ? "ide_cursor" : "ide_vscode",
      action: "upload",
      byte_count: byteCount,
      aggregate_hash: aggregateHash,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return json({
    ok: true,
    score_contribution: scoreContrib,
    session_id: sessionId,
  });
}
