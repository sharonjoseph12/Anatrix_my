// packages/types/signals.ts — 11/10 — privacy-center snapshot types
// Unified signal-source surface for /settings/signals per
// specs/006-deep-signal-capture/spec.md FR-PRI-001..008 + FR-CAP-001/002/003.
// The provider/action enums also back the signal_audit table (data-model
// lines 267-296) and are re-imported by audit.ts.

import type { BiometricProvider } from "./biometrics";
import type { IDEEditor } from "./ide-telemetry";

export type SignalProvider =
  | "ide_vscode"
  | "ide_cursor"
  | "biometric_healthkit"
  | "biometric_google_fit"
  | "biometric_oura"
  | "biometric_whoop"
  | "privacy_center"
  | "admin_audit"
  | "dpdp_erasure";

export type SignalAction =
  | "enable"
  | "disable"
  | "upload"
  | "read"
  | "delete_all"
  | "delete_one"
  | "audit_read"
  | "erasure_complete";

export type SignalSourceKind = "ide" | "biometric";

export type SignalSourceStatus = "connected" | "disconnected" | "expired";

export interface SignalSourceAggregateSummary {
  period_start: string;
  score_contribution?: number;
  summary?: Record<string, string | number | null>;
}

export interface SignalSource {
  provider: SignalProvider;
  kind: SignalSourceKind;
  status: SignalSourceStatus;
  editor?: IDEEditor;
  biometric_provider?: BiometricProvider;
  connected_at?: string | null;
  last_sync_at?: string | null;
  last_5_aggregates: SignalSourceAggregateSummary[];
  what_we_learned: string;
  total_score_cap_pct: 3 | 2;
}

export interface SignalCenterSnapshot {
  sources: SignalSource[];
  total_active_score_cap_pct: 5;
  partial_capture: boolean;
}
