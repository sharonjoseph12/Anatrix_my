// ATS types — mirrors migration 035 (ats_connections, ats_saved_searches, ats_sync_log)

export type AtsProvider = "greenhouse" | "lever";

export type AtsConnectionStatus = "active" | "paused" | "revoked";

export type AtsSyncStatus = "success" | "retry" | "failed_permanent";

export interface AtsConnection {
  id: string;
  recruiter_id: string;
  provider: AtsProvider;
  // Encrypted at rest via pgsodium; never expose to client browsers.
  api_key_encrypted: string;
  pool_id: string | null;
  status: AtsConnectionStatus;
  last_sync_at: string | null;
  failure_count: number;
  created_at: string;
}

export interface AtsSavedSearch {
  id: string;
  connection_id: string;
  name: string;
  query_json: Record<string, unknown>;
  min_score: number; // 0..100
  active: boolean;
  last_evaluated_at: string | null;
  created_at: string;
}

export interface AtsSavedSearchQuery {
  skills?: string[];
  locations?: string[];
  batch_years?: number[];
  min_hours_logged?: number;
  specializations?: string[];
}

export interface AtsSyncLog {
  id: number; // bigserial
  connection_id: string;
  saved_search_id: string;
  student_id: string;
  status: AtsSyncStatus;
  attempt: number;
  error: string | null;
  pushed_at: string;
}

export interface PushCandidatePayload {
  student_id: string;
  display_name: string;
  email: string;
  skill_proof_score: number;
  primary_specialization?: string;
  specialization_scores: Record<string, number>;
  total_hours_logged: number;
  institution_name?: string;
  batch_year?: number;
  profile_url: string;
}
