import type { Json } from "./database";

export type CollabRoomKind = "self_practice" | "paired_with_mentor" | "team";
export type CollabLanguage = "javascript" | "typescript" | "python" | "go" | "rust" | "other";
export type CollabSandboxKind = "webcontainer" | "firecracker";
export type CollabRoomStatus = "scheduled" | "live" | "ended" | "cancelled";
export type CollabParticipantRole = "host" | "participant" | "observer" | "recruiter_observer";
export type CollabLeaveReason = "ended" | "left" | "kicked" | "network_lost" | "account_deleted";
export type CollabConsentScope = "observe_live" | "observe_recorded" | "read_teamwork_score";

export interface CollabRoom {
  id: string;
  kind: CollabRoomKind;
  cohort_id: string | null;
  invited_by: string;
  scheduled_start: string;
  duration_minutes: number;
  language: CollabLanguage;
  sandbox_kind: CollabSandboxKind;
  status: CollabRoomStatus;
  consent_required: boolean;
  ends_at: string | null;
  created_at: string;
}

export interface CollabParticipant {
  id: string;
  room_id: string;
  user_id: string;
  role: CollabParticipantRole;
  joined_at: string;
  left_at: string | null;
  left_reason: CollabLeaveReason | null;
  opt_out_teamwork: boolean;
  consent_id: string | null;
}

export interface CollabEvent {
  id: number;
  room_id: string;
  user_id: string;
  event_type: string;
  payload_json: Json;
  seq: number;
  created_at: string;
}

export interface CollabArtifact {
  id: string;
  room_id: string;
  code_snapshot_url: string;
  transcript_url: string | null;
  events_url: string;
  language: string;
  duration_seconds: number;
  ended_at: string;
}

export interface TeamworkSubScores {
  turn_taking: number;
  code_balance: number;
  conflict_resolution: number;
  help_events: number;
}

export interface TeamworkScore {
  id: string;
  room_id: string;
  user_id: string | null;
  score: number;
  sub_scores_json: TeamworkSubScores;
  breakdown_json: { reasons: string[]; input_counts?: Record<string, number> };
  computed_at: string;
}

export interface CollabRecording {
  id: string;
  room_id: string;
  observer_user_id: string;
  recording_url: string | null;
  started_at: string;
  ended_at: string | null;
  redacted: boolean;
  purge_after: string;
}

export interface CollabConsent {
  id: string;
  room_id: string;
  user_id: string;
  grantee_user_id: string;
  scopes: CollabConsentScope[];
  granted_at: string;
  revoked_at: string | null;
  expires_at: string | null;
}

export interface CollabSnapshot {
  id: string;
  room_id: string;
  seq_at_snapshot: number;
  snapshot_url: string;
  created_at: string;
}

export type CollabAuditActorType = "system" | "student" | "mentor" | "recruiter" | "faculty" | "admin";
export type CollabAuditAction =
  | "consent_granted"
  | "consent_revoked"
  | "consent_expired"
  | "observer_joined"
  | "observer_left"
  | "opt_out_changed"
  | "sandbox_boot"
  | "sandbox_shutdown"
  | "recording_started"
  | "recording_purged"
  | "flag_raised";

export interface CollabAudit {
  id: number;
  actor_id: string | null;
  actor_type: CollabAuditActorType;
  action: CollabAuditAction;
  subject_room_id: string;
  payload_json: Json;
  created_at: string;
}
