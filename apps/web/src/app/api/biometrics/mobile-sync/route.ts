// apps/web/src/app/api/biometrics/mobile-sync/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US2 (FR-BIO-001, FR-BIO-002, FR-CAP-002)
//   contracts/api.md → POST /api/biometrics/mobile-sync
// Receives a daily aggregate from the Expo mobile bridge. HMAC-verifies
// the request body with the shared MOBILE_BRIDGE_SHARED_SECRET, then
// upserts a biometric_aggregates row (period_type='daily') and writes
// a signal_audit row.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { ZodSignals } from "@antarix/types";
import { hashStructured, clampBiometricScore } from "@antarix/utils";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { writeSignalAudit } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const MAX_SKEW_MS = 5 * 60 * 1000;

function isFlagEnabled(): boolean {
  return process.env.FF_006_BIOMETRICS_MOBILE === "on";
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function verifySignature(secret: string, timestamp: string, body: string, signature: string): boolean {
  const expected = createHash("sha256").update(timestamp + body + secret, "utf8").digest("hex");
  return timingSafeEqualHex(expected, signature.toLowerCase());
}

export async function POST(req: NextRequest) {
  if (!isFlagEnabled()) {
    return err("not_found", "Feature not available", 404);
  }

  const secret = process.env.MOBILE_BRIDGE_SHARED_SECRET;
  if (!secret) {
    return err("not_configured", "MOBILE_BRIDGE_SHARED_SECRET is not set", 503);
  }

  const signature = req.headers.get("x-antarix-device-signature");
  const timestamp = req.headers.get("x-antarix-device-timestamp");
  if (!signature || !timestamp) {
    return err("unauthorized", "Missing X-Antarix-Device-Signature or -Timestamp", 401);
  }
  const tsMs = Date.parse(timestamp);
  if (!Number.isFinite(tsMs)) {
    return err("unauthorized", "Invalid timestamp", 401);
  }
  if (Math.abs(Date.now() - tsMs) > MAX_SKEW_MS) {
    return err("unauthorized", "Timestamp skew exceeds 5 minutes", 401);
  }

  const rawBody = await req.text();
  if (!verifySignature(secret, timestamp, rawBody, signature)) {
    return err("unauthorized", "Invalid signature", 401);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return err("invalid_input", "Body is not valid JSON", 400);
  }

  const parsed = ZodSignals.biometricMobileSyncSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "Invalid request", issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const studentId = req.headers.get("x-antarix-student-id");
  if (!studentId) {
    return err("unauthorized", "Missing X-Antarix-Student-Id header", 401);
  }

  const service = createSupabaseServiceClient();
  const { data: connRow, error: cErr } = await service
    .from("biometric_connections")
    .select("id, student_id")
    .eq("student_id", studentId)
    .eq("provider", data.provider)
    .maybeSingle();
  if (cErr) return err("internal_error", cErr.message, 500);
  if (!connRow) {
    return err("not_found", "no biometric connection for this provider", 404);
  }
  const connectionId = (connRow as { id: string }).id;
  const studentIdValue = (connRow as { student_id: string }).student_id;

  const sourceHash = hashStructured({
    provider: data.provider,
    period_start: data.day,
    sleep_duration_minutes: data.sleep_duration_minutes ?? null,
    sleep_quality_score: data.sleep_quality_score ?? null,
    hrv_ms: data.hrv_ms ?? null,
    resting_hr_bpm: data.resting_hr_bpm ?? null,
    daily_readiness_score: data.daily_readiness_score ?? null,
  });

  const { error: upsertErr } = await service
    .from("biometric_aggregates")
    .upsert(
      {
        connection_id: connectionId,
        student_id: studentIdValue,
        provider: data.provider,
        period_type: "daily",
        period_start: data.day,
        sleep_duration_minutes: data.sleep_duration_minutes ?? null,
        sleep_quality_score: data.sleep_quality_score ?? null,
        hrv_ms: data.hrv_ms ?? null,
        resting_hr_bpm: data.resting_hr_bpm ?? null,
        daily_readiness_score: data.daily_readiness_score ?? null,
        source_hash: sourceHash,
      },
      { onConflict: "connection_id,period_type,period_start" },
    );
  if (upsertErr) return err("internal_error", upsertErr.message, 500);

  const readiness = data.daily_readiness_score ?? 50;
  const scoreContribution = clampBiometricScore(0.5 + 0.5 * (readiness / 100));

  const auditProvider: "biometric_healthkit" | "biometric_google_fit" =
    data.provider === "healthkit" ? "biometric_healthkit" : "biometric_google_fit";

  try {
    await writeSignalAudit({
      actor_id: null,
      actor_type: "system",
      student_id: studentIdValue,
      provider: auditProvider,
      action: "upload",
      byte_count: Buffer.byteLength(rawBody, "utf8"),
      aggregate_hash: sourceHash,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return NextResponse.json({ ok: true, score_contribution: scoreContribution });
}
