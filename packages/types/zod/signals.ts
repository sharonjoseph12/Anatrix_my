// packages/types/zod/signals.ts — 11/10 — request schemas for signal capture
// Zod schemas for the public endpoints in
// specs/006-deep-signal-capture/spec.md FR-IDE-002/003, FR-BIO-002/007,
// FR-PRI-003. Server-side validation; CHECK constraints in migration 039
// remain the authoritative defense-in-depth (data-model.md lines 126-238).

import { z } from "zod";

export const ideSessionUploadSchema = z.object({
  device_id: z.string().uuid(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  duration_seconds: z.number().int().min(60).max(1800),
  editor: z.enum(["vscode", "cursor"]),
  project_hash: z.string().regex(/^[a-f0-9]{64}$/),
  language: z.string().min(1).max(64),
  keystroke_entropy_bpm: z.number().min(0).max(20),
  debug_session_duration_seconds: z.number().int().min(0).default(0),
  debug_step_ratio: z.number().min(0).max(1).default(0),
  ast_refactor_distance: z.number().int().min(0).default(0),
  time_in_file_seconds: z.number().int().min(0).default(0),
  test_run_count: z.number().int().min(0).default(0),
  error_resolution_latency_ms: z.number().int().min(0).default(0),
  raw_partial_capture: z.boolean().default(false),
});
export type IDESessionUpload = z.infer<typeof ideSessionUploadSchema>;

export const biometricMobileSyncSchema = z.object({
  device_id: z.string().uuid(),
  provider: z.enum(["healthkit", "google_fit"]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleep_duration_minutes: z.number().int().min(0).max(1440).optional(),
  sleep_quality_score: z.number().int().min(0).max(100).optional(),
  hrv_ms: z.number().int().min(0).max(300).optional(),
  resting_hr_bpm: z.number().int().min(20).max(200).optional(),
  daily_readiness_score: z.number().int().min(0).max(100).optional(),
  timestamp: z.string().datetime(),
});
export type BiometricMobileSync = z.infer<typeof biometricMobileSyncSchema>;

export const deleteAllSignalsSchema = z.object({
  confirmation: z.literal("DELETE_ALL"),
});
export type DeleteAllSignals = z.infer<typeof deleteAllSignalsSchema>;
