// Database types — auto-generated from Supabase schema
// Run: npx supabase gen types typescript --local > packages/types/database.ts
// This file mirrors the Supabase-generated shape; relationship slots are empty arrays.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserType = "student" | "professional";
export type PlatformRole = "student" | "placement_officer" | "recruiter" | "admin";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type SessionCategory =
  | "dsa"
  | "coding"
  | "project"
  | "learning"
  | "research";
export type FocusLevel = "high" | "medium" | "low";
export type ProficiencyLevel =
  | "novice"
  | "developing"
  | "proficient"
  | "advanced"
  | "expert";
export type InsightType =
  | "peak_window"
  | "workflow_pattern"
  | "skill_detection"
  | "productivity_trend"
  | "burnout_risk"
  | "category_success";
export type JobMatchStatus =
  | "matched"
  | "reached_out"
  | "interview_scheduled"
  | "interview_completed"
  | "hired"
  | "rejected";
export type GithubStatus = "active" | "disconnected" | "expired";
export type CalendarProvider = "google" | "microsoft";
export type CalendarStatus = "active" | "disconnected" | "expired";
export type CohortType = "institutional" | "interest" | "custom";
export type InstitutionType = "college" | "university" | "bootcamp" | "corporate_training";
export type InstitutionRole = "student" | "faculty" | "admin" | "placement_officer";
export type InstitutionTier = "starter" | "growth" | "enterprise";
export type CompanyTier = "startup" | "growth" | "enterprise";
export type CompanyRole = "admin" | "recruiter" | "hiring_manager";

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  user_type: UserType;
  goals: string[] | null;
  skill_level: SkillLevel | null;
  working_hours_start: number | null;
  working_hours_end: number | null;
  onboarding_step: string;
  onboarding_completed_at: string | null;
  avatar_url: string | null;
  role: PlatformRole;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  category: SessionCategory;
  project_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  focus_level: FocusLevel;
  focus_score: number | null;
  quality_rating: number | null;
  tab_switches: number | null;
  distraction_seconds: number | null;
  extensions_used: Json;
  notes: string | null;
  client_id: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface GithubAccount {
  id: string;
  user_id: string;
  github_id: number;
  username: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  scope: string | null;
  status: GithubStatus;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GithubActivity {
  id: string;
  user_id: string;
  github_account_id: string;
  commit_hash: string;
  repo_name: string;
  repo_full_name: string;
  primary_language: string | null;
  files_changed: number | null;
  additions: number | null;
  deletions: number | null;
  message: string | null;
  committed_at: string;
  created_at: string;
}

export interface CalendarAccount {
  id: string;
  user_id: string;
  provider: CalendarProvider;
  email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  status: CalendarStatus;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  calendar_account_id: string;
  event_id: string;
  title: string | null;
  description: string | null;
  start_at: string;
  end_at: string | null;
  event_type: string | null;
  is_focused: boolean | null;
  category: SessionCategory | null;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category: string;
  difficulty_level: number;
  industry_demand: number;
  avg_hours_to_proficiency: number | null;
  description: string | null;
  created_at: string;
}

export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  hours_logged: number;
  projects_completed: number;
  avg_completion_rate: number | null;
  avg_focus_quality: number | null;
  hours_score: number | null;
  projects_score: number | null;
  quality_score: number | null;
  consistency_score: number | null;
  skill_proof_score: number;
  proficiency_level: ProficiencyLevel;
  last_project_date: string | null;
  validated_by_institution: boolean;
  last_calculated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Insight {
  id: string;
  user_id: string;
  type: InsightType;
  title: string;
  description: string | null;
  metric_value: number | null;
  metric_unit: string | null;
  metric_metadata: Json;
  confidence: number | null;
  data_points: number;
  recommended_action: string | null;
  generated_for_week: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

export interface Cohort {
  id: string;
  name: string;
  description: string | null;
  institution_id: string | null;
  cohort_type: CohortType;
  is_public: boolean;
  invite_code: string | null;
  created_by: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CohortMember {
  id: string;
  cohort_id: string;
  user_id: string;
  joined_at: string;
}

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  location: string | null;
  city: string | null;
  country: string;
  subscription_tier: InstitutionTier;
  subscription_start_date: string | null;
  annual_cost: number | null;
  total_students: number;
  tracked_students: number;
  placement_rate: number | null;
  avg_skill_proof_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface InstitutionMember {
  id: string;
  institution_id: string;
  user_id: string;
  role: InstitutionRole;
  batch_year: number | null;
  department: string | null;
  roll_number: string | null;
  specialization: string | null;
  joined_at: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  logo_url: string | null;
  subscription_tier: CompanyTier;
  subscription_start_date: string | null;
  monthly_cost: number | null;
  skill_preferences: Json;
  min_skill_proof_score: number;
  preferred_batch_years: Json;
  preferred_locations: Json;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  joined_at: string;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  institution_id: string | null;
  headline: string | null;
  bio: string | null;
  overall_skill_proof_score: number;
  primary_specialization: string | null;
  specialization_scores: Json;
  total_hours_logged: number;
  total_projects_completed: number;
  total_sessions: number;
  total_commits: number;
  avg_project_completion_rate: number | null;
  avg_focus_quality: number | null;
  peak_window: Json;
  placement_ready: boolean;
  is_public: boolean;
  is_open_to_opportunities: boolean;
  preferred_locations: Json;
  preferred_role_types: Json;
  expected_salary_min: number | null;
  expected_salary_max: number | null;
  last_updated_at: string;
  created_at: string;
}

export interface RecruiterSearch {
  id: string;
  company_id: string;
  recruiter_id: string;
  search_name: string;
  skill_filters: Json;
  min_skill_proof_score: number;
  batch_years: Json;
  locations: Json;
  results_count: number;
  created_at: string;
  updated_at: string;
}

export interface JobMatch {
  id: string;
  recruiter_search_id: string | null;
  company_id: string;
  candidate_id: string;
  recruiter_id: string;
  position_title: string | null;
  match_score: number;
  skills_match: number | null;
  experience_match: number | null;
  availability_match: number | null;
  status: JobMatchStatus;
  notes: string | null;
  reached_out_at: string | null;
  interview_scheduled_at: string | null;
  interview_completed_at: string | null;
  hired_at: string | null;
  created_at: string;
  updated_at: string;
}

type EmptyRelationships = [];

type TableShape<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: EmptyRelationships;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      users: TableShape<User, {
        id: string;
        email: string;
        display_name?: string | null;
        user_type?: UserType;
        goals?: string[] | null;
        skill_level?: SkillLevel | null;
        working_hours_start?: number | null;
        working_hours_end?: number | null;
        onboarding_step?: string;
        onboarding_completed_at?: string | null;
        avatar_url?: string | null;
        role?: PlatformRole;
        created_at?: string;
        updated_at?: string;
      }>;
      sessions: TableShape<Session, {
        id?: string;
        user_id: string;
        category: SessionCategory;
        project_name?: string | null;
        started_at: string;
        ended_at?: string | null;
        duration_minutes?: number | null;
        focus_level?: FocusLevel;
        focus_score?: number | null;
        quality_rating?: number | null;
        tab_switches?: number | null;
        distraction_seconds?: number | null;
        extensions_used?: Json;
        notes?: string | null;
        client_id?: string | null;
        synced_at?: string | null;
        created_at?: string;
      }>;
      github_accounts: TableShape<GithubAccount, {
        id?: string;
        user_id: string;
        github_id: number;
        username: string;
        access_token_encrypted: string;
        refresh_token_encrypted?: string | null;
        scope?: string | null;
        status?: GithubStatus;
        last_synced_at?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      github_activity: TableShape<GithubActivity, {
        id?: string;
        user_id: string;
        github_account_id: string;
        commit_hash: string;
        repo_name: string;
        repo_full_name: string;
        primary_language?: string | null;
        files_changed?: number | null;
        additions?: number | null;
        deletions?: number | null;
        message?: string | null;
        committed_at: string;
        created_at?: string;
      }>;
      calendar_accounts: TableShape<CalendarAccount, {
        id?: string;
        user_id: string;
        provider?: CalendarProvider;
        email: string;
        access_token_encrypted: string;
        refresh_token_encrypted?: string | null;
        token_expires_at?: string | null;
        status?: CalendarStatus;
        last_synced_at?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      calendar_events: TableShape<CalendarEvent, {
        id?: string;
        user_id: string;
        calendar_account_id: string;
        event_id: string;
        title?: string | null;
        description?: string | null;
        start_at: string;
        end_at?: string | null;
        event_type?: string | null;
        is_focused?: boolean | null;
        category?: SessionCategory | null;
        created_at?: string;
      }>;
      skills: TableShape<Skill, {
        id?: string;
        name: string;
        slug: string;
        category: string;
        difficulty_level: number;
        industry_demand: number;
        avg_hours_to_proficiency?: number | null;
        description?: string | null;
        created_at?: string;
      }>;
      user_skills: TableShape<UserSkill, {
        id?: string;
        user_id: string;
        skill_id: string;
        hours_logged?: number;
        projects_completed?: number;
        avg_completion_rate?: number | null;
        avg_focus_quality?: number | null;
        hours_score?: number | null;
        projects_score?: number | null;
        quality_score?: number | null;
        consistency_score?: number | null;
        skill_proof_score?: number;
        proficiency_level?: ProficiencyLevel;
        last_project_date?: string | null;
        validated_by_institution?: boolean;
        last_calculated_at?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      insights: TableShape<Insight, {
        id?: string;
        user_id: string;
        type: InsightType;
        title: string;
        description?: string | null;
        metric_value?: number | null;
        metric_unit?: string | null;
        metric_metadata?: Json;
        confidence?: number | null;
        data_points?: number;
        recommended_action?: string | null;
        generated_for_week?: string | null;
        valid_from?: string;
        valid_until?: string | null;
        created_at?: string;
      }>;
      cohorts: TableShape<Cohort, {
        id?: string;
        name: string;
        description?: string | null;
        institution_id?: string | null;
        cohort_type?: CohortType;
        is_public?: boolean;
        invite_code?: string | null;
        created_by?: string | null;
        member_count?: number;
        created_at?: string;
        updated_at?: string;
      }>;
      cohort_members: TableShape<CohortMember, {
        id?: string;
        cohort_id: string;
        user_id: string;
        joined_at?: string;
      }>;
      institutions: TableShape<Institution, {
        id?: string;
        name: string;
        type: InstitutionType;
        location?: string | null;
        city?: string | null;
        country?: string;
        subscription_tier?: InstitutionTier;
        subscription_start_date?: string | null;
        annual_cost?: number | null;
        total_students?: number;
        tracked_students?: number;
        placement_rate?: number | null;
        avg_skill_proof_score?: number | null;
        created_at?: string;
        updated_at?: string;
      }>;
      institution_members: TableShape<InstitutionMember, {
        id?: string;
        institution_id: string;
        user_id: string;
        role?: InstitutionRole;
        batch_year?: number | null;
        department?: string | null;
        roll_number?: string | null;
        specialization?: string | null;
        joined_at?: string;
      }>;
      companies: TableShape<Company, {
        id?: string;
        name: string;
        industry?: string | null;
        location?: string | null;
        city?: string | null;
        country?: string | null;
        website?: string | null;
        logo_url?: string | null;
        subscription_tier?: CompanyTier;
        subscription_start_date?: string | null;
        monthly_cost?: number | null;
        skill_preferences?: Json;
        min_skill_proof_score?: number;
        preferred_batch_years?: Json;
        preferred_locations?: Json;
        created_at?: string;
        updated_at?: string;
      }>;
      company_members: TableShape<CompanyMember, {
        id?: string;
        company_id: string;
        user_id: string;
        role?: CompanyRole;
        joined_at?: string;
      }>;
      candidate_profiles: TableShape<CandidateProfile, {
        id?: string;
        user_id: string;
        institution_id?: string | null;
        headline?: string | null;
        bio?: string | null;
        overall_skill_proof_score?: number;
        primary_specialization?: string | null;
        specialization_scores?: Json;
        total_hours_logged?: number;
        total_projects_completed?: number;
        total_sessions?: number;
        total_commits?: number;
        avg_project_completion_rate?: number | null;
        avg_focus_quality?: number | null;
        peak_window?: Json;
        placement_ready?: boolean;
        is_public?: boolean;
        is_open_to_opportunities?: boolean;
        preferred_locations?: Json;
        preferred_role_types?: Json;
        expected_salary_min?: number | null;
        expected_salary_max?: number | null;
        last_updated_at?: string;
        created_at?: string;
      }>;
      recruiter_searches: TableShape<RecruiterSearch, {
        id?: string;
        company_id: string;
        recruiter_id: string;
        search_name: string;
        skill_filters?: Json;
        min_skill_proof_score?: number;
        batch_years?: Json;
        locations?: Json;
        results_count?: number;
        created_at?: string;
        updated_at?: string;
      }>;
      job_matches: TableShape<JobMatch, {
        id?: string;
        recruiter_search_id?: string | null;
        company_id: string;
        candidate_id: string;
        recruiter_id: string;
        position_title?: string | null;
        match_score?: number;
        skills_match?: number | null;
        experience_match?: number | null;
        availability_match?: number | null;
        status?: JobMatchStatus;
        notes?: string | null;
        reached_out_at?: string | null;
        interview_scheduled_at?: string | null;
        interview_completed_at?: string | null;
        hired_at?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_type: UserType;
      platform_role: PlatformRole;
      skill_level: SkillLevel;
      session_category: SessionCategory;
      focus_level: FocusLevel;
      proficiency_level: ProficiencyLevel;
      insight_type: InsightType;
      job_match_status: JobMatchStatus;
      github_status: GithubStatus;
      calendar_provider: CalendarProvider;
      calendar_status: CalendarStatus;
      cohort_type: CohortType;
      institution_type: InstitutionType;
      institution_role: InstitutionRole;
      institution_tier: InstitutionTier;
      company_tier: CompanyTier;
      company_role: CompanyRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
