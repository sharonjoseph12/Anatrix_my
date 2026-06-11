// packages/types/biometrics.ts — 11/10 — biometric integration types
// Mirrors migration 039 (biometric_connections, biometric_aggregates) per
// specs/006-deep-signal-capture/data-model.md lines 189-238 and
// specs/006-deep-signal-capture/spec.md FR-BIO-001..007 + FR-CAP-002/003.

export type BiometricProvider = "healthkit" | "google_fit" | "oura" | "whoop";

export type BiometricConnectionStatus =
  | "connected"
  | "expired"
  | "disconnected";

export type BiometricScope = "sleep" | "hrv" | "resting_hr" | "readiness";

export type BiometricPeriodType = "daily" | "monthly";

export interface BiometricConnection {
  id?: string;
  student_id: string;
  provider: BiometricProvider;
  status: BiometricConnectionStatus;
  oauth_refresh_token_encrypted?: string | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  connected_at?: string;
  scopes_json: BiometricScope[];
}

export interface BiometricAggregate {
  id?: string;
  connection_id: string;
  student_id: string;
  provider: BiometricProvider;
  period_type: BiometricPeriodType;
  period_start: string;
  sleep_duration_minutes?: number | null;
  sleep_quality_score?: number | null;
  hrv_ms?: number | null;
  resting_hr_bpm?: number | null;
  daily_readiness_score?: number | null;
  source_hash: string;
  created_at?: string;
}

export interface OuraDailySummary {
  day: string;
  score?: number;
  hrv_avg?: number;
  resting_heart_rate?: number;
}

export interface WhoopDailySummary {
  cycle_start: string;
  recovery_score?: number;
  hrv_ms?: number;
  resting_heart_rate?: number;
  sleep_duration_min?: number;
}
