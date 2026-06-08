// packages/types/audit.ts — 11/10 — signal_audit row + admin dump types
// Mirrors migration 039 (signal_audit) per
// specs/006-deep-signal-capture/data-model.md lines 267-296 and
// specs/006-deep-signal-capture/spec.md FR-PRI-004/005/008 + FR-AUD-001..003.
// The signal_audit table is append-only; `id` is a Postgres bigserial.

import type { SignalAction, SignalProvider } from "./signals";

export type AuditActorType = "system" | "student" | "admin" | "college_admin";

export interface SignalAuditRow {
  id: number;
  actor_id: string | null;
  actor_type: AuditActorType;
  student_id: string;
  provider: SignalProvider;
  action: SignalAction;
  byte_count: number;
  aggregate_hash: string | null;
  payload_redacted: boolean;
  created_at: string;
}

export interface AuditDumpResponse {
  rows: SignalAuditRow[];
  next_cursor: number | null;
  total_estimated: number;
}
