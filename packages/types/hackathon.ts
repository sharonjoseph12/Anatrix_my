// Hackathon types — mirrors migration 036 (hackathons, hackathon_submissions, hackathon_credentials)

export type HackathonStatus = "draft" | "live" | "completed" | "cancelled";

export type HackathonLanguage =
  | "python"
  | "javascript"
  | "typescript"
  | "go"
  | "rust";

export type HackathonCredentialKind =
  | "participation"
  | "top_10_pct"
  | "top_1_pct"
  | "winner";

// JSONB shape of `hackathons.prize_structure`. The schema is intentionally open
// (recruiter-defined keys like "top_5_pct", "top_1", etc.) so we use a
// string->reward map; per-amount/percentage metadata is string-typed because
// values are heterogeneous ("interview_fast_track" vs "cash_5000_inr").
export type PrizeStructure = Record<string, string>;

export interface Hackathon {
  id: string;
  recruiter_id: string;
  title: string;
  problem: string;
  test_cases_url: string;
  starts_at: string;
  ends_at: string;
  prize_structure: PrizeStructure;
  status: HackathonStatus;
  created_at: string;
}

export interface HackathonSubmission {
  id: string;
  hackathon_id: string;
  student_id: string;
  code_url: string;
  language: HackathonLanguage;
  test_results: Record<string, unknown> | null;
  score: number | null; // 0..100
  submitted_at: string;
  graded_at: string | null;
}

export interface HackathonCredential {
  id: string;
  hackathon_id: string;
  student_id: string;
  rank: number | null;
  kind: HackathonCredentialKind;
  vc_id: string | null;
  issued_at: string;
}
