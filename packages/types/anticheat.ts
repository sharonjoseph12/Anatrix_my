// Anti-cheat types — mirrors migration 034 (anticheat_signals, anticheat_appeals, anticheat_audit)

export type AnticheatSignalKind =
  | "fork_no_commits"
  | "commit_cluster_time"
  | "ai_generated_suspect"
  | "copied_content_overlap"
  | "impossible_velocity"
  | "rating_delta_anomaly"
  | "collab_typing_divergence";

export type AnticheatEntityType = "github_repo" | "dsa_record" | "collab_room";

export type AnticheatAppealStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

export type AnticheatActorType = "system" | "student" | "mentor" | "admin";

export type AnticheatAuditAction =
  | "quarantine"
  | "appeal_filed"
  | "appeal_decided"
  | "manual_override";

export interface AnticheatSignal {
  id: string;
  entity_type: AnticheatEntityType;
  entity_id: string;
  student_id: string;
  signal: AnticheatSignalKind;
  confidence: number; // 0..1
  evidence_url: string | null;
  evidence_payload: Record<string, unknown> | null;
  detected_at: string;
  superseded_by: string | null;
}

export interface AnticheatAppeal {
  id: string;
  signal_id: string;
  student_id: string;
  explanation: string;
  evidence_url: string | null;
  status: AnticheatAppealStatus;
  mentor_id: string | null;
  mentor_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface AnticheatAuditRow {
  id: number; // bigserial
  actor_id: string | null;
  actor_type: AnticheatActorType;
  action: AnticheatAuditAction;
  subject_signal_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

// Result envelope produced by a detector pass; persisted via insert to anticheat_signals.
export interface SignalDetectionResult {
  signal: AnticheatSignalKind;
  confidence: number;
  evidence: Record<string, unknown>;
}
