// packages/types/ide-telemetry.ts — 11/10 — IDE telemetry signal types
// Mirrors migration 039 (ide_sessions, ide_aggregates) per
// specs/006-deep-signal-capture/data-model.md lines 126-186 and
// specs/006-deep-signal-capture/spec.md FR-IDE-001..006 + FR-CAP-001/003.

export type IDEEditor = "vscode" | "cursor";

export type IDEAggregatePeriodType = "daily" | "monthly";

export interface IDESession {
  id?: string;
  device_id: string;
  student_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  editor: IDEEditor;
  project_hash: string;
  language: string;
  keystroke_entropy_bpm: number;
  debug_session_duration_seconds: number;
  debug_step_ratio: number;
  ast_refactor_distance: number;
  time_in_file_seconds: number;
  test_run_count: number;
  error_resolution_latency_ms: number;
  raw_partial_capture: boolean;
  uploaded_at?: string;
}

export interface IDEAggregate {
  id?: string;
  device_id: string;
  student_id: string;
  day: string;
  session_count: number;
  total_active_seconds: number;
  language_breakdown_json: Record<string, number>;
  productivity_score_raw: number;
  score_contribution: number;
  period_type: IDEAggregatePeriodType;
  period_start: string;
  computed_at?: string;
}

export interface IDETelemetrySnapshot {
  device_id: string;
  student_id: string;
  sessions: IDESession[];
  aggregates: IDEAggregate[];
  last_5_aggregates: IDEAggregate[];
}
