// API request/response types — mirrors contracts/api.md

import type {
  Session,
  Insight,
  UserSkill,
  CandidateProfile,
  Cohort,
  Institution,
  Company,
  JobMatch,
  UserType,
  SessionCategory,
  ProficiencyLevel,
  JobMatchStatus,
} from "./database";

// =============================================================================
// Auth
// =============================================================================
export interface SignupRequest {
  email: string;
  password: string;
  display_name: string;
  user_type: UserType;
}
export interface SignupResponse {
  user_id: string;
  email: string;
  requires_verification: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  user_id: string;
  email: string;
  role: UserType;
  access_token: string;
  refresh_token: string;
}

export interface OAuthCallbackRequest {
  code: string;
  provider: "github" | "google";
  next?: string;
}
export interface OAuthCallbackResponse {
  user_id: string;
  provider: "github" | "google";
  redirect_to: string;
}

// =============================================================================
// Onboarding
// =============================================================================
export interface UpdateProfileRequest {
  display_name?: string;
  goals?: string[];
  skill_level?: "beginner" | "intermediate" | "advanced" | "expert";
  working_hours?: { start: string; end: string };
  onboarding_step?: number;
  onboarding_completed_at?: string;
}
export interface UpdateProfileResponse {
  user_id: string;
  updated_fields: string[];
}

// =============================================================================
// Sessions (extension upload)
// =============================================================================
export interface SessionUploadRequest {
  sessions: Array<{
    client_id: string;
    category: SessionCategory;
    project_name?: string;
    started_at: string;
    ended_at: string;
    duration_minutes: number;
    focus_level: "high" | "medium" | "low";
    focus_score?: number;
    tab_switches?: number;
    distraction_seconds?: number;
  }>;
}
export interface SessionUploadResponse {
  accepted: number;
  duplicates: number;
  rejected: number;
  session_ids: string[];
}

// =============================================================================
// Dashboard
// =============================================================================
export interface DashboardBrief {
  greeting: string;
  performance_score: number;
  performance_trend: "up" | "down" | "stable";
  recommended_action: {
    title: string;
    description: string;
    action_url: string;
  } | null;
  alerts: Array<{
    type: "risk" | "opportunity";
    title: string;
    description: string;
  }>;
  weekly_stats: {
    sessions_count: number;
    total_hours: number;
    commits: number;
    active_days: number;
  };
  days_until_insights: number | null;
}

export interface SessionHistoryQuery {
  page?: number;
  limit?: number;
  category?: SessionCategory;
  from_date?: string;
  to_date?: string;
}
export interface SessionHistoryResponse {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// =============================================================================
// Insights
// =============================================================================
export interface PeakWindowInsight {
  start_hour: number;
  end_hour: number;
  multiplier: number;
  confidence: number;
  best_days: string[];
}
export interface WorkflowPatternInsight {
  pattern: SessionCategory[];
  success_rate: number;
  avg_duration: number;
  confidence: number;
}
export interface SkillDetectionInsight {
  skill_name: string;
  proficiency: ProficiencyLevel;
  evidence: {
    commits: number;
    repos: number;
    hours: number;
  };
}

export type InsightResponse = Insight;

// =============================================================================
// Skills
// =============================================================================
export interface UserSkillResponse extends UserSkill {
  skill_name: string;
  skill_slug: string;
  category: string;
}
export interface SkillScoreBreakdown {
  hours_score: number;
  projects_score: number;
  quality_score: number;
  consistency_score: number;
  total_score: number;
  proficiency: ProficiencyLevel;
  next_level: ProficiencyLevel | null;
  points_to_next_level: number | null;
}

// =============================================================================
// Cohorts
// =============================================================================
export interface CohortListResponse {
  cohorts: Array<Cohort & { member_count: number; avg_focus_quality: number | null }>;
}
export interface CohortComparisonResponse {
  cohort_id: string;
  cohort_name: string;
  cohort_size: number;
  you_vs_cohort: {
    productivity: { you: number; cohort: number; advantage: "you" | "cohort" | "tie" };
    focus_quality: { you: number; cohort: number; advantage: "you" | "cohort" | "tie" };
    workflow_pattern: { you: string; cohort: string };
    consistency: { you: number; cohort: number; advantage: "you" | "cohort" | "tie" };
  };
  anonymized_aggregates: {
    avg_peak_window: { startHour: number; endHour: number };
    avg_focus_quality: number;
    avg_productivity: number;
  };
}
export interface JoinCohortRequest {
  invite_code: string;
}
export interface JoinCohortResponse {
  cohort_id: string;
  joined_at: string;
}

// =============================================================================
// Institution (College portal)
// =============================================================================
export interface CreateInstitutionRequest {
  name: string;
  type: "university" | "college" | "bootcamp";
  location?: string;
  subscription_tier: "free" | "pro" | "enterprise";
}
export type CreateInstitutionResponse = Institution;

export interface CsvImportRequest {
  students: Array<{
    email: string;
    display_name: string;
    batch_year: number;
    department?: string;
    roll_number?: string;
  }>;
}
export interface CsvImportResponse {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; email: string; reason: string }>;
  invitation_sent: number;
}

export interface PlacementDashboardResponse {
  institution_id: string;
  total_students: number;
  readiness_tiers: {
    ready_now: number;
    development_path: number;
    early_stage: number;
  };
  top_performers: Array<{
    user_id: string;
    display_name: string;
    overall_skill_score: number;
    top_skill: string;
  }>;
  skill_gaps: Array<{
    skill_name: string;
    students_missing: number;
    demand: number;
    recommendation: string;
  }>;
}

// =============================================================================
// Company (Recruiter portal)
// =============================================================================
export interface CreateCompanyRequest {
  name: string;
  industry?: string;
  location?: string;
  website?: string;
  subscription_tier: "free" | "pro" | "enterprise";
}
export type CreateCompanyResponse = Company;

export interface CandidateSearchRequest {
  skills: string[];
  min_skill_score: number;
  batch_years: number[];
  locations: string[];
  min_match_score?: number;
  specialization?: string;
  is_open_to_opportunities?: boolean;
  page?: number;
  limit?: number;
}
export interface CandidateSearchResult {
  candidate: CandidateProfile;
  display_name: string;
  match_score: number;
  matching_skills: string[];
  specialization_breakdown: Array<{
    skill_name: string;
    score: number;
    proficiency: ProficiencyLevel;
  }>;
  top_projects: Array<{ name: string; language: string | null; commits: number }>;
  focus_quality: number;
  peak_window: { startHour: number; endHour: number };
  college: string | null;
  batch_year: number | null;
}
export interface CandidateSearchResponse {
  results: CandidateSearchResult[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface ScheduleInterviewRequest {
  candidate_id: string;
  position_title: string;
  scheduled_at: string;
  format: "video" | "phone" | "in_person";
  notes?: string;
}
export interface ScheduleInterviewResponse {
  job_match_id: string;
  scheduled_at: string;
  candidate_notified: boolean;
}

export interface UpdateJobMatchStatusRequest {
  status: JobMatchStatus;
  notes?: string;
}
export type UpdateJobMatchStatusResponse = JobMatch;

export interface CompanyAnalyticsResponse {
  company_id: string;
  period: { from: string; to: string };
  positions_filled: number;
  active_positions: number;
  pipeline_funnel: Record<JobMatchStatus, number>;
  retention_rate: number;
  avg_skill_proof_of_hires: number;
  roi_metrics: {
    cost_per_hire: number;
    time_to_hire_days: number;
    hire_quality_score: number;
  };
}

// =============================================================================
// Generic error envelope
// =============================================================================
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
