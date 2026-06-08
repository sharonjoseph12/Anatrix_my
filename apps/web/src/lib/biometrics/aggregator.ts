// apps/web/src/lib/biometrics/aggregator.ts
// Spec: specs/006-deep-signal-capture/spec.md FR-BIO-002, FR-CAP-002
//   data-model.md lines 211-238
// Pure functions: map Oura/Whoop daily summaries → biometric_aggregates row
// with deterministic SHA-256 source_hash. No I/O, no DB, no network.

import { randomUUID } from "node:crypto";
import { hashStructured } from "@antarix/utils/hash";
import type {
  BiometricAggregate,
  BiometricPeriodType,
  BiometricProvider,
  OuraDailySummary,
  WhoopDailySummary,
} from "@antarix/types/biometrics";

export function aggregateOuraDaily(
  daily: OuraDailySummary,
  connectionId: string,
  studentId: string,
): BiometricAggregate {
  const period_start: string = daily.day;
  const sleep_quality_score = numericOrNull(daily.score);
  const hrv_ms = numericOrNull(daily.hrv_avg);
  const resting_hr_bpm = numericOrNull(daily.resting_heart_rate);
  return buildAggregate({
    connection_id: connectionId,
    student_id: studentId,
    provider: "oura",
    period_type: "daily" satisfies BiometricPeriodType,
    period_start,
    sleep_duration_minutes: null,
    sleep_quality_score,
    hrv_ms,
    resting_hr_bpm,
    daily_readiness_score: null,
  });
}

export function aggregateWhoopDaily(
  daily: WhoopDailySummary,
  connectionId: string,
  studentId: string,
): BiometricAggregate {
  const period_start: string = daily.cycle_start.slice(0, 10);
  const sleep_duration_minutes = numericOrNull(daily.sleep_duration_min);
  const daily_readiness_score = numericOrNull(daily.recovery_score);
  const hrv_ms = numericOrNull(daily.hrv_ms);
  const resting_hr_bpm = numericOrNull(daily.resting_heart_rate);
  return buildAggregate({
    connection_id: connectionId,
    student_id: studentId,
    provider: "whoop",
    period_type: "daily" satisfies BiometricPeriodType,
    period_start,
    sleep_duration_minutes,
    sleep_quality_score: null,
    hrv_ms,
    resting_hr_bpm,
    daily_readiness_score,
  });
}

interface AggregateFields {
  connection_id: string;
  student_id: string;
  provider: BiometricProvider;
  period_type: BiometricPeriodType;
  period_start: string;
  sleep_duration_minutes: number | null;
  sleep_quality_score: number | null;
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
  daily_readiness_score: number | null;
}

function buildAggregate(f: AggregateFields): BiometricAggregate {
  const source_hash = hashStructured({
    provider: f.provider,
    period_start: f.period_start,
    sleep_duration_minutes: f.sleep_duration_minutes,
    sleep_quality_score: f.sleep_quality_score,
    hrv_ms: f.hrv_ms,
    resting_hr_bpm: f.resting_hr_bpm,
    daily_readiness_score: f.daily_readiness_score,
  });
  return {
    id: randomUUID(),
    connection_id: f.connection_id,
    student_id: f.student_id,
    provider: f.provider,
    period_type: f.period_type,
    period_start: f.period_start,
    sleep_duration_minutes: f.sleep_duration_minutes,
    sleep_quality_score: f.sleep_quality_score,
    hrv_ms: f.hrv_ms,
    resting_hr_bpm: f.resting_hr_bpm,
    daily_readiness_score: f.daily_readiness_score,
    source_hash,
    created_at: new Date().toISOString(),
  };
}

function numericOrNull(v: number | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}
