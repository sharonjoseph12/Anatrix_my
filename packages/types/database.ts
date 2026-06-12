export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alumni_profiles: {
        Row: {
          bio: string | null
          created_at: string
          employer: string | null
          lesson_progression_topics: string[]
          no_show_count: number
          opted_in_for_mentorship: boolean
          opted_out: boolean
          opted_out_at: string | null
          public_profile_visible: boolean
          rating_avg: number | null
          rating_count: number
          role: string | null
          sessions_count: number
          specialty_tags: string[]
          target_company_tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          employer?: string | null
          lesson_progression_topics?: string[]
          no_show_count?: number
          opted_in_for_mentorship?: boolean
          opted_out?: boolean
          opted_out_at?: string | null
          public_profile_visible?: boolean
          rating_avg?: number | null
          rating_count?: number
          role?: string | null
          sessions_count?: number
          specialty_tags?: string[]
          target_company_tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          employer?: string | null
          lesson_progression_topics?: string[]
          no_show_count?: number
          opted_in_for_mentorship?: boolean
          opted_out?: boolean
          opted_out_at?: string | null
          public_profile_visible?: boolean
          rating_avg?: number | null
          rating_count?: number
          role?: string | null
          sessions_count?: number
          specialty_tags?: string[]
          target_company_tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alumni_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      answer_preview: {
        Row: {
          approved_at: string | null
          auto_approve_at: string
          chat_session_id: string | null
          citation_links: Json
          created_at: string
          edited_answer: string | null
          id: string
          llm_answer: string
          recruiter_id: string
          recruiter_question: string
          rejected_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          approved_at?: string | null
          auto_approve_at?: string
          chat_session_id?: string | null
          citation_links?: Json
          created_at?: string
          edited_answer?: string | null
          id?: string
          llm_answer: string
          recruiter_id: string
          recruiter_question: string
          rejected_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          approved_at?: string | null
          auto_approve_at?: string
          chat_session_id?: string | null
          citation_links?: Json
          created_at?: string
          edited_answer?: string | null
          id?: string
          llm_answer?: string
          recruiter_id?: string
          recruiter_question?: string
          rejected_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_preview_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "recruiter_chat_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_preview_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_preview_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "answer_preview_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_preview_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      anticheat_appeals: {
        Row: {
          created_at: string
          decided_at: string | null
          evidence_url: string | null
          explanation: string
          id: string
          mentor_id: string | null
          mentor_note: string | null
          signal_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          evidence_url?: string | null
          explanation: string
          id?: string
          mentor_id?: string | null
          mentor_note?: string | null
          signal_id: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          evidence_url?: string | null
          explanation?: string
          id?: string
          mentor_id?: string | null
          mentor_note?: string | null
          signal_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticheat_appeals_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticheat_appeals_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "anticheat_appeals_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "anticheat_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticheat_appeals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticheat_appeals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      anticheat_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: number
          payload: Json
          subject_signal_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: number
          payload: Json
          subject_signal_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: number
          payload?: Json
          subject_signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticheat_audit_subject_signal_id_fkey"
            columns: ["subject_signal_id"]
            isOneToOne: false
            referencedRelation: "anticheat_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      anticheat_signals: {
        Row: {
          confidence: number
          detected_at: string
          entity_id: string
          entity_type: string
          evidence_payload: Json | null
          evidence_url: string | null
          id: string
          signal: string
          student_id: string
          superseded_by: string | null
        }
        Insert: {
          confidence: number
          detected_at?: string
          entity_id: string
          entity_type: string
          evidence_payload?: Json | null
          evidence_url?: string | null
          id?: string
          signal: string
          student_id: string
          superseded_by?: string | null
        }
        Update: {
          confidence?: number
          detected_at?: string
          entity_id?: string
          entity_type?: string
          evidence_payload?: Json | null
          evidence_url?: string | null
          id?: string
          signal?: string
          student_id?: string
          superseded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anticheat_signals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticheat_signals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "anticheat_signals_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "anticheat_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit_rpm: number
          revoked_at: string | null
          scopes: string[]
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit_rpm?: number
          revoked_at?: string | null
          scopes: string[]
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit_rpm?: number
          revoked_at?: string | null
          scopes?: string[]
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      assignments: {
        Row: {
          course_code: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          institution_id: string
          max_grade: number
          title: string
        }
        Insert: {
          course_code?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          institution_id: string
          max_grade?: number
          title: string
        }
        Update: {
          course_code?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          institution_id?: string
          max_grade?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "assignments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_connections: {
        Row: {
          api_key_encrypted: string
          created_at: string
          failure_count: number
          id: string
          last_sync_at: string | null
          pool_id: string | null
          provider: string
          recruiter_id: string
          status: string
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string
          failure_count?: number
          id?: string
          last_sync_at?: string | null
          pool_id?: string | null
          provider: string
          recruiter_id: string
          status?: string
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string
          failure_count?: number
          id?: string
          last_sync_at?: string | null
          pool_id?: string | null
          provider?: string
          recruiter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_connections_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_connections_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ats_saved_searches: {
        Row: {
          active: boolean
          connection_id: string
          created_at: string
          id: string
          last_evaluated_at: string | null
          min_score: number
          name: string
          query_json: Json
        }
        Insert: {
          active?: boolean
          connection_id: string
          created_at?: string
          id?: string
          last_evaluated_at?: string | null
          min_score?: number
          name: string
          query_json: Json
        }
        Update: {
          active?: boolean
          connection_id?: string
          created_at?: string
          id?: string
          last_evaluated_at?: string | null
          min_score?: number
          name?: string
          query_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ats_saved_searches_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "ats_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_sync_log: {
        Row: {
          attempt: number
          connection_id: string
          error: string | null
          id: number
          pushed_at: string
          saved_search_id: string
          status: string
          student_id: string
        }
        Insert: {
          attempt: number
          connection_id: string
          error?: string | null
          id?: number
          pushed_at?: string
          saved_search_id: string
          status: string
          student_id: string
        }
        Update: {
          attempt?: number
          connection_id?: string
          error?: string | null
          id?: number
          pushed_at?: string
          saved_search_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_sync_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "ats_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sync_log_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "ats_saved_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sync_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sync_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      authorship_proof: {
        Row: {
          baseline_similarity: number | null
          completed_at: string | null
          confidence_score: number | null
          created_at: string
          id: string
          project_id: string
          session_vector: Json | null
          status: string
          student_id: string
          verifiable_credential_url: string | null
        }
        Insert: {
          baseline_similarity?: number | null
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          project_id: string
          session_vector?: Json | null
          status?: string
          student_id: string
          verifiable_credential_url?: string | null
        }
        Update: {
          baseline_similarity?: number | null
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          project_id?: string
          session_vector?: Json | null
          status?: string
          student_id?: string
          verifiable_credential_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorship_proof_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorship_proof_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      authorship_sandbox_sessions: {
        Row: {
          ast_diff_sequence: Json
          created_at: string
          duration_seconds: number
          error_recovery_vector: Json
          id: string
          keystroke_timing_vector: Json
          proof_id: string
        }
        Insert: {
          ast_diff_sequence: Json
          created_at?: string
          duration_seconds: number
          error_recovery_vector: Json
          id?: string
          keystroke_timing_vector: Json
          proof_id: string
        }
        Update: {
          ast_diff_sequence?: Json
          created_at?: string
          duration_seconds?: number
          error_recovery_vector?: Json
          id?: string
          keystroke_timing_vector?: Json
          proof_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorship_sandbox_sessions_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "authorship_proof"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_revocations: {
        Row: {
          badge_id: string
          badge_nonce: string
          created_at: string
          id: string
          reason: string | null
          revoked_by: string
        }
        Insert: {
          badge_id: string
          badge_nonce: string
          created_at?: string
          id?: string
          reason?: string | null
          revoked_by: string
        }
        Update: {
          badge_id?: string
          badge_nonce?: string
          created_at?: string
          id?: string
          reason?: string | null
          revoked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "badge_revocations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_revocations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      biometric_aggregates: {
        Row: {
          connection_id: string
          created_at: string
          daily_readiness_score: number | null
          hrv_ms: number | null
          id: string
          period_start: string
          period_type: string
          provider: string
          resting_hr_bpm: number | null
          sleep_duration_minutes: number | null
          sleep_quality_score: number | null
          source_hash: string
          student_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          daily_readiness_score?: number | null
          hrv_ms?: number | null
          id?: string
          period_start: string
          period_type: string
          provider: string
          resting_hr_bpm?: number | null
          sleep_duration_minutes?: number | null
          sleep_quality_score?: number | null
          source_hash: string
          student_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          daily_readiness_score?: number | null
          hrv_ms?: number | null
          id?: string
          period_start?: string
          period_type?: string
          provider?: string
          resting_hr_bpm?: number | null
          sleep_duration_minutes?: number | null
          sleep_quality_score?: number | null
          source_hash?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biometric_aggregates_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "biometric_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_aggregates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_aggregates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      biometric_connections: {
        Row: {
          connected_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          oauth_refresh_token_encrypted: string | null
          provider: string
          scopes_json: Json
          status: string
          student_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          oauth_refresh_token_encrypted?: string | null
          provider: string
          scopes_json: Json
          status?: string
          student_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          oauth_refresh_token_encrypted?: string | null
          provider?: string
          scopes_json?: Json
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biometric_connections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_connections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      calendar_accounts: {
        Row: {
          access_token_encrypted: string
          created_at: string
          email: string
          id: string
          last_error: string | null
          last_error_at: string | null
          last_synced_at: string | null
          provider: Database["public"]["Enums"]["calendar_provider"]
          refresh_token_encrypted: string | null
          status: Database["public"]["Enums"]["calendar_account_status"]
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          email: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"]
          refresh_token_encrypted?: string | null
          status?: Database["public"]["Enums"]["calendar_account_status"]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          email?: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"]
          refresh_token_encrypted?: string | null
          status?: Database["public"]["Enums"]["calendar_account_status"]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          attendee_count: number | null
          calendar_account_id: string
          category: Database["public"]["Enums"]["session_category"] | null
          created_at: string
          derived_event_type: string | null
          description: string | null
          end_at: string | null
          event_id: string
          event_type: string | null
          id: string
          is_all_day: boolean
          is_focused: boolean | null
          start_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          attendee_count?: number | null
          calendar_account_id: string
          category?: Database["public"]["Enums"]["session_category"] | null
          created_at?: string
          derived_event_type?: string | null
          description?: string | null
          end_at?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          is_all_day?: boolean
          is_focused?: boolean | null
          start_at: string
          title?: string | null
          user_id: string
        }
        Update: {
          attendee_count?: number | null
          calendar_account_id?: string
          category?: Database["public"]["Enums"]["session_category"] | null
          created_at?: string
          derived_event_type?: string | null
          description?: string | null
          end_at?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          is_all_day?: boolean
          is_focused?: boolean | null
          start_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          avg_focus_quality: number | null
          avg_project_completion_rate: number | null
          bio: string | null
          company_search_visible: boolean
          created_at: string
          current_streak_days: number
          expected_salary_max: number | null
          expected_salary_min: number | null
          headline: string | null
          id: string
          institution_id: string | null
          is_open_to_opportunities: boolean
          is_public: boolean
          last_score_change_at: string | null
          last_updated_at: string
          overall_skill_proof_score: number
          peak_window: Json | null
          peak_window_end_local_hour: number | null
          peak_window_start_local_hour: number | null
          per_skill_scores: Json | null
          placement_ready: boolean
          power_mode_bonus_active: boolean
          preferred_locations: Json | null
          preferred_role_types: Json | null
          primary_specialization: string | null
          skill_proof_score: number | null
          slug: string | null
          specialization_scores: Json | null
          total_commits: number
          total_hours_logged: number
          total_projects_completed: number
          total_sessions: number
          user_id: string
        }
        Insert: {
          avg_focus_quality?: number | null
          avg_project_completion_rate?: number | null
          bio?: string | null
          company_search_visible?: boolean
          created_at?: string
          current_streak_days?: number
          expected_salary_max?: number | null
          expected_salary_min?: number | null
          headline?: string | null
          id?: string
          institution_id?: string | null
          is_open_to_opportunities?: boolean
          is_public?: boolean
          last_score_change_at?: string | null
          last_updated_at?: string
          overall_skill_proof_score?: number
          peak_window?: Json | null
          peak_window_end_local_hour?: number | null
          peak_window_start_local_hour?: number | null
          per_skill_scores?: Json | null
          placement_ready?: boolean
          power_mode_bonus_active?: boolean
          preferred_locations?: Json | null
          preferred_role_types?: Json | null
          primary_specialization?: string | null
          skill_proof_score?: number | null
          slug?: string | null
          specialization_scores?: Json | null
          total_commits?: number
          total_hours_logged?: number
          total_projects_completed?: number
          total_sessions?: number
          user_id: string
        }
        Update: {
          avg_focus_quality?: number | null
          avg_project_completion_rate?: number | null
          bio?: string | null
          company_search_visible?: boolean
          created_at?: string
          current_streak_days?: number
          expected_salary_max?: number | null
          expected_salary_min?: number | null
          headline?: string | null
          id?: string
          institution_id?: string | null
          is_open_to_opportunities?: boolean
          is_public?: boolean
          last_score_change_at?: string | null
          last_updated_at?: string
          overall_skill_proof_score?: number
          peak_window?: Json | null
          peak_window_end_local_hour?: number | null
          peak_window_start_local_hour?: number | null
          per_skill_scores?: Json | null
          placement_ready?: boolean
          power_mode_bonus_active?: boolean
          preferred_locations?: Json | null
          preferred_role_types?: Json | null
          primary_specialization?: string | null
          skill_proof_score?: number | null
          slug?: string | null
          specialization_scores?: Json | null
          total_commits?: number
          total_hours_logged?: number
          total_projects_completed?: number
          total_sessions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chain_mirror_audit: {
        Row: {
          action: string
          attempt_index: number
          attestation_uid: string | null
          block_number: number | null
          consent_version: string | null
          created_at: string
          credential_id: string | null
          effective_gas_price_wei: number | null
          error_message: string | null
          gas_used: number | null
          id: number
          institution_id: string | null
          student_id: string
          tx_hash: string | null
          usd_cost: number | null
        }
        Insert: {
          action: string
          attempt_index?: number
          attestation_uid?: string | null
          block_number?: number | null
          consent_version?: string | null
          created_at?: string
          credential_id?: string | null
          effective_gas_price_wei?: number | null
          error_message?: string | null
          gas_used?: number | null
          id?: number
          institution_id?: string | null
          student_id: string
          tx_hash?: string | null
          usd_cost?: number | null
        }
        Update: {
          action?: string
          attempt_index?: number
          attestation_uid?: string | null
          block_number?: number | null
          consent_version?: string | null
          created_at?: string
          credential_id?: string | null
          effective_gas_price_wei?: number | null
          error_message?: string | null
          gas_used?: number | null
          id?: number
          institution_id?: string | null
          student_id?: string
          tx_hash?: string | null
          usd_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chain_mirror_audit_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_audit_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_audit_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_audit_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chain_mirror_consents: {
        Row: {
          consent_text_hash: string
          consent_version: string
          custodial_derivation_path: string | null
          granted_at: string
          id: string
          ip_hash: string
          revoked_at: string | null
          student_id: string
          user_agent: string
          wallet_address: string
          wallet_type: string
        }
        Insert: {
          consent_text_hash: string
          consent_version: string
          custodial_derivation_path?: string | null
          granted_at?: string
          id?: string
          ip_hash: string
          revoked_at?: string | null
          student_id: string
          user_agent: string
          wallet_address: string
          wallet_type: string
        }
        Update: {
          consent_text_hash?: string
          consent_version?: string
          custodial_derivation_path?: string | null
          granted_at?: string
          id?: string
          ip_hash?: string
          revoked_at?: string | null
          student_id?: string
          user_agent?: string
          wallet_address?: string
          wallet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_mirror_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chain_mirror_queue: {
        Row: {
          attempt_count: number
          attestation_uid: string | null
          confirmed_at: string | null
          created_at: string
          credential_id: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          status: string
          student_id: string
        }
        Insert: {
          attempt_count?: number
          attestation_uid?: string | null
          confirmed_at?: string | null
          created_at?: string
          credential_id: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          status?: string
          student_id: string
        }
        Update: {
          attempt_count?: number
          attestation_uid?: string | null
          confirmed_at?: string | null
          created_at?: string
          credential_id?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_mirror_queue_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chain_mirror_revocations: {
        Row: {
          attestation_uid: string
          audit_id: number
          block_number: number
          credential_id: string
          id: string
          institution_id: string | null
          reason: string
          revoke_tx_hash: string
          revoked_at: string
          student_id: string
        }
        Insert: {
          attestation_uid: string
          audit_id: number
          block_number: number
          credential_id: string
          id?: string
          institution_id?: string | null
          reason: string
          revoke_tx_hash: string
          revoked_at?: string
          student_id: string
        }
        Update: {
          attestation_uid?: string
          audit_id?: number
          block_number?: number
          credential_id?: string
          id?: string
          institution_id?: string | null
          reason?: string
          revoke_tx_hash?: string
          revoked_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_mirror_revocations_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "chain_mirror_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_revocations_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_revocations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_revocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_revocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chain_mirror_schema: {
        Row: {
          id: number
          registered_at: string
          registered_by: string | null
          registered_tx_hash: string
          schema_string: string
          schema_uid: string
          status: string
          version: string
        }
        Insert: {
          id?: number
          registered_at?: string
          registered_by?: string | null
          registered_tx_hash: string
          schema_string: string
          schema_uid: string
          status?: string
          version: string
        }
        Update: {
          id?: number
          registered_at?: string
          registered_by?: string | null
          registered_tx_hash?: string
          schema_string?: string
          schema_uid?: string
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_mirror_schema_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_mirror_schema_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chain_reputation_bonuses: {
        Row: {
          attester_reputation_contract: string
          bonus_attestation_uid: string
          bonus_level: number
          credential_id: string
          id: string
          issued_at: string
          student_id: string
        }
        Insert: {
          attester_reputation_contract: string
          bonus_attestation_uid: string
          bonus_level?: number
          credential_id: string
          id?: string
          issued_at?: string
          student_id: string
        }
        Update: {
          attester_reputation_contract?: string
          bonus_attestation_uid?: string
          bonus_level?: number
          credential_id?: string
          id?: string
          issued_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_reputation_bonuses_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_reputation_bonuses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_reputation_bonuses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cohort_members: {
        Row: {
          cohort_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cohorts: {
        Row: {
          cohort_type: Database["public"]["Enums"]["cohort_type"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          institution_id: string | null
          invite_code: string | null
          is_public: boolean
          member_count: number
          name: string
          updated_at: string
        }
        Insert: {
          cohort_type?: Database["public"]["Enums"]["cohort_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          institution_id?: string | null
          invite_code?: string | null
          is_public?: boolean
          member_count?: number
          name: string
          updated_at?: string
        }
        Update: {
          cohort_type?: Database["public"]["Enums"]["cohort_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          institution_id?: string | null
          invite_code?: string | null
          is_public?: boolean
          member_count?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collab_artifacts: {
        Row: {
          code_snapshot_url: string
          duration_seconds: number
          ended_at: string
          events_url: string
          id: string
          language: string
          room_id: string
          transcript_url: string | null
        }
        Insert: {
          code_snapshot_url: string
          duration_seconds: number
          ended_at?: string
          events_url: string
          id?: string
          language: string
          room_id: string
          transcript_url?: string | null
        }
        Update: {
          code_snapshot_url?: string
          duration_seconds?: number
          ended_at?: string
          events_url?: string
          id?: string
          language?: string
          room_id?: string
          transcript_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collab_artifacts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: number
          payload_json: Json
          subject_room_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: number
          payload_json?: Json
          subject_room_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: number
          payload_json?: Json
          subject_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collab_audit_subject_room_id_fkey"
            columns: ["subject_room_id"]
            isOneToOne: false
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_consents: {
        Row: {
          expires_at: string | null
          granted_at: string
          grantee_user_id: string
          id: string
          revoked_at: string | null
          room_id: string
          scopes: string[]
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          grantee_user_id: string
          id?: string
          revoked_at?: string | null
          room_id: string
          scopes: string[]
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          grantee_user_id?: string
          id?: string
          revoked_at?: string | null
          room_id?: string
          scopes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_consents_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_consents_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collab_consents_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collab_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          payload_json: Json
          room_id: string
          seq: number
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          payload_json?: Json
          room_id: string
          seq: number
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          payload_json?: Json
          room_id?: string
          seq?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collab_participants: {
        Row: {
          consent_id: string | null
          id: string
          joined_at: string
          left_at: string | null
          left_reason: string | null
          opt_out_teamwork: boolean
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          consent_id?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          left_reason?: string | null
          opt_out_teamwork?: boolean
          role: string
          room_id: string
          user_id: string
        }
        Update: {
          consent_id?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          left_reason?: string | null
          opt_out_teamwork?: boolean
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_participants_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "collab_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collab_recordings: {
        Row: {
          ended_at: string | null
          id: string
          observer_user_id: string
          purge_after: string
          recording_url: string | null
          redacted: boolean
          room_id: string
          started_at: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          observer_user_id: string
          purge_after: string
          recording_url?: string | null
          redacted?: boolean
          room_id: string
          started_at?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          observer_user_id?: string
          purge_after?: string
          recording_url?: string | null
          redacted?: boolean
          room_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_recordings_observer_user_id_fkey"
            columns: ["observer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_recordings_observer_user_id_fkey"
            columns: ["observer_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collab_recordings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_rooms: {
        Row: {
          cohort_id: string | null
          consent_required: boolean
          created_at: string
          duration_minutes: number
          ends_at: string | null
          id: string
          invited_by: string
          kind: string
          language: string
          sandbox_kind: string
          scheduled_start: string
          status: string
        }
        Insert: {
          cohort_id?: string | null
          consent_required?: boolean
          created_at?: string
          duration_minutes?: number
          ends_at?: string | null
          id?: string
          invited_by: string
          kind: string
          language: string
          sandbox_kind: string
          scheduled_start: string
          status?: string
        }
        Update: {
          cohort_id?: string | null
          consent_required?: boolean
          created_at?: string
          duration_minutes?: number
          ends_at?: string | null
          id?: string
          invited_by?: string
          kind?: string
          language?: string
          sandbox_kind?: string
          scheduled_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_rooms_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_rooms_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_rooms_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collab_snapshots: {
        Row: {
          created_at: string
          id: string
          room_id: string
          seq_at_snapshot: number
          snapshot_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          seq_at_snapshot: number
          snapshot_url: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          seq_at_snapshot?: number
          snapshot_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_snapshots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          min_skill_proof_score: number | null
          monthly_cost: number | null
          monthly_search_credit_balance: number
          monthly_search_credit_reset_at: string | null
          name: string
          open_positions: Json
          owner_user_id: string | null
          plan: string
          preferred_batch_years: Json | null
          preferred_locations: Json | null
          search_filter: Json
          skill_preferences: Json | null
          subscription_start_date: string | null
          subscription_tier: Database["public"]["Enums"]["company_tier"]
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          min_skill_proof_score?: number | null
          monthly_cost?: number | null
          monthly_search_credit_balance?: number
          monthly_search_credit_reset_at?: string | null
          name: string
          open_positions?: Json
          owner_user_id?: string | null
          plan?: string
          preferred_batch_years?: Json | null
          preferred_locations?: Json | null
          search_filter?: Json
          skill_preferences?: Json | null
          subscription_start_date?: string | null
          subscription_tier?: Database["public"]["Enums"]["company_tier"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          min_skill_proof_score?: number | null
          monthly_cost?: number | null
          monthly_search_credit_balance?: number
          monthly_search_credit_reset_at?: string | null
          name?: string
          open_positions?: Json
          owner_user_id?: string | null
          plan?: string
          preferred_batch_years?: Json | null
          preferred_locations?: Json | null
          search_filter?: Json
          skill_preferences?: Json | null
          subscription_start_date?: string | null
          subscription_tier?: Database["public"]["Enums"]["company_tier"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_with_open_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      credential_distributions: {
        Row: {
          artifact_url: string | null
          channel: Database["public"]["Enums"]["credential_channel"]
          credential_id: string
          generated_at: string
          id: string
        }
        Insert: {
          artifact_url?: string | null
          channel: Database["public"]["Enums"]["credential_channel"]
          credential_id: string
          generated_at?: string
          id?: string
        }
        Update: {
          artifact_url?: string | null
          channel?: Database["public"]["Enums"]["credential_channel"]
          credential_id?: string
          generated_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_distributions_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_cost_counters: {
        Row: {
          breach_log: Json
          cap_tokens: number
          created_at: string
          id: string
          lessons_generated: number
          scope: string
          scope_id: string
          tokens_used: number
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          breach_log?: Json
          cap_tokens: number
          created_at?: string
          id?: string
          lessons_generated?: number
          scope: string
          scope_id: string
          tokens_used?: number
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          breach_log?: Json
          cap_tokens?: number
          created_at?: string
          id?: string
          lessons_generated?: number
          scope?: string
          scope_id?: string
          tokens_used?: number
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      curriculum_lessons: {
        Row: {
          alumnus_project_link: string
          concept: string
          created_at: string
          created_for_date: string
          duration_minutes: number
          exercise_starter_code: string
          id: string
          recommender_debug: Json
          reflection_question: string
          scheduled_window_end: string
          scheduled_window_start: string
          student_id: string
          topic: string
        }
        Insert: {
          alumnus_project_link: string
          concept: string
          created_at?: string
          created_for_date: string
          duration_minutes: number
          exercise_starter_code: string
          id?: string
          recommender_debug?: Json
          reflection_question: string
          scheduled_window_end: string
          scheduled_window_start: string
          student_id: string
          topic: string
        }
        Update: {
          alumnus_project_link?: string
          concept?: string
          created_at?: string
          created_for_date?: string
          duration_minutes?: number
          exercise_starter_code?: string
          id?: string
          recommender_debug?: Json
          reflection_question?: string
          scheduled_window_end?: string
          scheduled_window_start?: string
          student_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dpdp_erasure_requests: {
        Row: {
          completed_at: string | null
          due_by: string
          id: string
          requested_at: string
          status: string
          student_id: string
        }
        Insert: {
          completed_at?: string | null
          due_by: string
          id?: string
          requested_at?: string
          status: string
          student_id: string
        }
        Update: {
          completed_at?: string | null
          due_by?: string
          id?: string
          requested_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpdp_erasure_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpdp_erasure_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      exam_windows: {
        Row: {
          confidence: number | null
          created_at: string
          detection_basis: Database["public"]["Enums"]["exam_window_basis"]
          end_date: string
          id: string
          start_date: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          detection_basis: Database["public"]["Enums"]["exam_window_basis"]
          end_date: string
          id?: string
          start_date: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          detection_basis?: Database["public"]["Enums"]["exam_window_basis"]
          end_date?: string
          id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_windows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_windows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      extension_telemetry: {
        Row: {
          browser: string | null
          created_at: string
          extension_version: string
          id: number
          last_heartbeat_at: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          extension_version: string
          id?: number
          last_heartbeat_at: string
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          extension_version?: string
          id?: number
          last_heartbeat_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_telemetry_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_telemetry_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      external_channel_handles: {
        Row: {
          channel: string
          created_at: string
          disconnected_reason: string | null
          handle: string
          id: string
          platform_id: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          disconnected_reason?: string | null
          handle: string
          id?: string
          platform_id?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          disconnected_reason?: string | null
          handle?: string
          id?: string
          platform_id?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_channel_handles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_channel_handles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      faculty_grades: {
        Row: {
          assignment_id: string
          comment: string | null
          faculty_id: string
          grade: number
          graded_at: string
          id: string
          student_id: string
        }
        Insert: {
          assignment_id: string
          comment?: string | null
          faculty_id: string
          grade: number
          graded_at?: string
          id?: string
          student_id: string
        }
        Update: {
          assignment_id?: string
          comment?: string | null
          faculty_id?: string
          grade?: number
          graded_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculty_grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_grades_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_grades_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "faculty_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      faculty_verifications: {
        Row: {
          id: string
          institution_id: string
          revoked_at: string | null
          user_id: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          id?: string
          institution_id: string
          revoked_at?: string | null
          user_id: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          id?: string
          institution_id?: string
          revoked_at?: string | null
          user_id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faculty_verifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "faculty_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      github_accounts: {
        Row: {
          access_token_encrypted: string
          anticheat_score: number | null
          created_at: string
          github_id: number
          id: string
          last_error: string | null
          last_error_at: string | null
          last_synced_at: string | null
          quarantined_at: string | null
          refresh_token_encrypted: string | null
          scope: string | null
          status: Database["public"]["Enums"]["github_account_status"]
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          access_token_encrypted: string
          anticheat_score?: number | null
          created_at?: string
          github_id: number
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_synced_at?: string | null
          quarantined_at?: string | null
          refresh_token_encrypted?: string | null
          scope?: string | null
          status?: Database["public"]["Enums"]["github_account_status"]
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          access_token_encrypted?: string
          anticheat_score?: number | null
          created_at?: string
          github_id?: number
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_synced_at?: string | null
          quarantined_at?: string | null
          refresh_token_encrypted?: string | null
          scope?: string | null
          status?: Database["public"]["Enums"]["github_account_status"]
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      github_activity: {
        Row: {
          additions: number | null
          commit_hash: string
          committed_at: string
          created_at: string
          deletions: number | null
          files_changed: number | null
          github_account_id: string
          id: string
          message: string | null
          primary_language: string | null
          repo_full_name: string
          repo_name: string
          user_id: string
        }
        Insert: {
          additions?: number | null
          commit_hash: string
          committed_at: string
          created_at?: string
          deletions?: number | null
          files_changed?: number | null
          github_account_id: string
          id?: string
          message?: string | null
          primary_language?: string | null
          repo_full_name: string
          repo_name: string
          user_id: string
        }
        Update: {
          additions?: number | null
          commit_hash?: string
          committed_at?: string
          created_at?: string
          deletions?: number | null
          files_changed?: number | null
          github_account_id?: string
          id?: string
          message?: string | null
          primary_language?: string | null
          repo_full_name?: string
          repo_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_activity_github_account_id_fkey"
            columns: ["github_account_id"]
            isOneToOne: false
            referencedRelation: "github_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      hackathon_credentials: {
        Row: {
          hackathon_id: string
          id: string
          issued_at: string
          kind: string
          rank: number | null
          student_id: string
          vc_id: string | null
        }
        Insert: {
          hackathon_id: string
          id?: string
          issued_at?: string
          kind: string
          rank?: number | null
          student_id: string
          vc_id?: string | null
        }
        Update: {
          hackathon_id?: string
          id?: string
          issued_at?: string
          kind?: string
          rank?: number | null
          student_id?: string
          vc_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_credentials_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_credentials_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_credentials_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "hackathon_credentials_vc_id_fkey"
            columns: ["vc_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_submissions: {
        Row: {
          code_url: string
          graded_at: string | null
          hackathon_id: string
          id: string
          language: string
          score: number | null
          student_id: string
          submitted_at: string
          test_results: Json | null
        }
        Insert: {
          code_url: string
          graded_at?: string | null
          hackathon_id: string
          id?: string
          language: string
          score?: number | null
          student_id: string
          submitted_at?: string
          test_results?: Json | null
        }
        Update: {
          code_url?: string
          graded_at?: string | null
          hackathon_id?: string
          id?: string
          language?: string
          score?: number | null
          student_id?: string
          submitted_at?: string
          test_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_submissions_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      hackathons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          prize_structure: Json
          problem: string
          recruiter_id: string
          starts_at: string
          status: string
          test_cases_url: string
          title: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          prize_structure: Json
          problem: string
          recruiter_id: string
          starts_at: string
          status?: string
          test_cases_url: string
          title: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          prize_structure?: Json
          problem?: string
          recruiter_id?: string
          starts_at?: string
          status?: string
          test_cases_url?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hackathons_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathons_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      i18n_missing_keys: {
        Row: {
          first_seen_at: string
          id: number
          key: string
          last_seen_at: string
          locale: string
          seen_count: number
        }
        Insert: {
          first_seen_at?: string
          id?: number
          key: string
          last_seen_at?: string
          locale: string
          seen_count?: number
        }
        Update: {
          first_seen_at?: string
          id?: number
          key?: string
          last_seen_at?: string
          locale?: string
          seen_count?: number
        }
        Relationships: []
      }
      ide_aggregates: {
        Row: {
          computed_at: string
          day: string
          device_id: string
          id: string
          language_breakdown_json: Json
          period_start: string
          period_type: string
          productivity_score_raw: number
          score_contribution: number
          session_count: number
          student_id: string
          total_active_seconds: number
        }
        Insert: {
          computed_at?: string
          day: string
          device_id: string
          id?: string
          language_breakdown_json?: Json
          period_start: string
          period_type: string
          productivity_score_raw?: number
          score_contribution?: number
          session_count?: number
          student_id: string
          total_active_seconds?: number
        }
        Update: {
          computed_at?: string
          day?: string
          device_id?: string
          id?: string
          language_breakdown_json?: Json
          period_start?: string
          period_type?: string
          productivity_score_raw?: number
          score_contribution?: number
          session_count?: number
          student_id?: string
          total_active_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "ide_aggregates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ide_aggregates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ide_sessions: {
        Row: {
          ast_refactor_distance: number
          debug_session_duration_seconds: number
          debug_step_ratio: number
          device_id: string
          duration_seconds: number
          editor: string
          ended_at: string
          error_resolution_latency_ms: number
          id: string
          keystroke_entropy_bpm: number
          language: string
          project_hash: string
          raw_partial_capture: boolean
          started_at: string
          student_id: string
          test_run_count: number
          time_in_file_seconds: number
          uploaded_at: string
        }
        Insert: {
          ast_refactor_distance?: number
          debug_session_duration_seconds?: number
          debug_step_ratio?: number
          device_id: string
          duration_seconds: number
          editor: string
          ended_at: string
          error_resolution_latency_ms?: number
          id?: string
          keystroke_entropy_bpm: number
          language: string
          project_hash: string
          raw_partial_capture?: boolean
          started_at: string
          student_id: string
          test_run_count?: number
          time_in_file_seconds?: number
          uploaded_at?: string
        }
        Update: {
          ast_refactor_distance?: number
          debug_session_duration_seconds?: number
          debug_step_ratio?: number
          device_id?: string
          duration_seconds?: number
          editor?: string
          ended_at?: string
          error_resolution_latency_ms?: number
          id?: string
          keystroke_entropy_bpm?: number
          language?: string
          project_hash?: string
          raw_partial_capture?: boolean
          started_at?: string
          student_id?: string
          test_run_count?: number
          time_in_file_seconds?: number
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ide_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ide_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insights: {
        Row: {
          confidence: number | null
          created_at: string
          data_points: number | null
          description: string | null
          generated_for_week: string | null
          id: string
          metric_metadata: Json | null
          metric_unit: string | null
          metric_value: number | null
          recommended_action: string | null
          title: string
          type: Database["public"]["Enums"]["insight_type"]
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          data_points?: number | null
          description?: string | null
          generated_for_week?: string | null
          id?: string
          metric_metadata?: Json | null
          metric_unit?: string | null
          metric_value?: number | null
          recommended_action?: string | null
          title: string
          type: Database["public"]["Enums"]["insight_type"]
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          data_points?: number | null
          description?: string | null
          generated_for_week?: string | null
          id?: string
          metric_metadata?: Json | null
          metric_unit?: string | null
          metric_value?: number | null
          recommended_action?: string | null
          title?: string
          type?: Database["public"]["Enums"]["insight_type"]
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      institution_members: {
        Row: {
          batch_year: number | null
          department: string | null
          id: string
          institution_id: string
          joined_at: string
          opted_in: boolean
          role: Database["public"]["Enums"]["institution_role"]
          roll_number: string | null
          specialization: string | null
          user_id: string
        }
        Insert: {
          batch_year?: number | null
          department?: string | null
          id?: string
          institution_id: string
          joined_at?: string
          opted_in?: boolean
          role?: Database["public"]["Enums"]["institution_role"]
          roll_number?: string | null
          specialization?: string | null
          user_id: string
        }
        Update: {
          batch_year?: number | null
          department?: string | null
          id?: string
          institution_id?: string
          joined_at?: string
          opted_in?: boolean
          role?: Database["public"]["Enums"]["institution_role"]
          roll_number?: string | null
          specialization?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_members_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      institution_nudge_settings: {
        Row: {
          channel: string
          created_by: string | null
          enabled: boolean
          enabled_at: string
          expires_at: string | null
          id: string
          institution_id: string
          set_by_user_id: string | null
        }
        Insert: {
          channel: string
          created_by?: string | null
          enabled?: boolean
          enabled_at?: string
          expires_at?: string | null
          id?: string
          institution_id: string
          set_by_user_id?: string | null
        }
        Update: {
          channel?: string
          created_by?: string | null
          enabled?: boolean
          enabled_at?: string
          expires_at?: string | null
          id?: string
          institution_id?: string
          set_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_nudge_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_nudge_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "institution_nudge_settings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_nudge_settings_set_by_user_id_fkey"
            columns: ["set_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_nudge_settings_set_by_user_id_fkey"
            columns: ["set_by_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      institutions: {
        Row: {
          annual_cost: number | null
          avg_skill_proof_score: number | null
          city: string | null
          country: string
          created_at: string
          id: string
          location: string | null
          name: string
          onchain_mirror_enabled: boolean
          placement_rate: number | null
          slug: string | null
          subscription_start_date: string | null
          subscription_tier: Database["public"]["Enums"]["institution_tier"]
          total_students: number
          tracked_students: number
          type: Database["public"]["Enums"]["institution_type"]
          updated_at: string
        }
        Insert: {
          annual_cost?: number | null
          avg_skill_proof_score?: number | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          location?: string | null
          name: string
          onchain_mirror_enabled?: boolean
          placement_rate?: number | null
          slug?: string | null
          subscription_start_date?: string | null
          subscription_tier?: Database["public"]["Enums"]["institution_tier"]
          total_students?: number
          tracked_students?: number
          type: Database["public"]["Enums"]["institution_type"]
          updated_at?: string
        }
        Update: {
          annual_cost?: number | null
          avg_skill_proof_score?: number | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          onchain_mirror_enabled?: boolean
          placement_rate?: number | null
          slug?: string | null
          subscription_start_date?: string | null
          subscription_tier?: Database["public"]["Enums"]["institution_tier"]
          total_students?: number
          tracked_students?: number
          type?: Database["public"]["Enums"]["institution_type"]
          updated_at?: string
        }
        Relationships: []
      }
      intake_positions: {
        Row: {
          closes_at: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          min_focus_quality: number | null
          min_hours_logged: number | null
          min_skill_proof_score: number
          openings: number
          posted_at: string
          preferred_batch_years: Json | null
          preferred_locations: Json | null
          required_skills: Json
          status: Database["public"]["Enums"]["position_status"]
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          min_focus_quality?: number | null
          min_hours_logged?: number | null
          min_skill_proof_score?: number
          openings?: number
          posted_at?: string
          preferred_batch_years?: Json | null
          preferred_locations?: Json | null
          required_skills?: Json
          status?: Database["public"]["Enums"]["position_status"]
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          min_focus_quality?: number | null
          min_hours_logged?: number | null
          min_skill_proof_score?: number
          openings?: number
          posted_at?: string
          preferred_batch_years?: Json | null
          preferred_locations?: Json | null
          required_skills?: Json
          status?: Database["public"]["Enums"]["position_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_with_open_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_slots: {
        Row: {
          candidate_calendar_free: boolean | null
          candidate_peak_window_match: boolean | null
          candidate_user_id: string
          created_at: string
          ends_at: string
          id: string
          interviewer_calendar_free: boolean | null
          job_match_id: string
          starts_at: string
          status: Database["public"]["Enums"]["interview_slot_status"]
        }
        Insert: {
          candidate_calendar_free?: boolean | null
          candidate_peak_window_match?: boolean | null
          candidate_user_id: string
          created_at?: string
          ends_at: string
          id?: string
          interviewer_calendar_free?: boolean | null
          job_match_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["interview_slot_status"]
        }
        Update: {
          candidate_calendar_free?: boolean | null
          candidate_peak_window_match?: boolean | null
          candidate_user_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          interviewer_calendar_free?: boolean | null
          job_match_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["interview_slot_status"]
        }
        Relationships: [
          {
            foreignKeyName: "interview_slots_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_slots_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "interview_slots_job_match_id_fkey"
            columns: ["job_match_id"]
            isOneToOne: false
            referencedRelation: "job_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      job_matches: {
        Row: {
          availability_match: number | null
          candidate_id: string
          company_id: string
          created_at: string
          experience_match: number | null
          hired_at: string | null
          id: string
          interview_completed_at: string | null
          interview_outcome: string | null
          interview_scheduled_at: string | null
          interview_scheduling_state: string
          match_score: number
          message: string | null
          notes: string | null
          position_title: string | null
          reached_out_at: string | null
          recruiter_id: string
          recruiter_search_id: string | null
          recruiter_user_id: string | null
          role_title: string | null
          skills_match: number | null
          source: string | null
          status: Database["public"]["Enums"]["job_match_status"]
          student_user_id: string | null
          updated_at: string
        }
        Insert: {
          availability_match?: number | null
          candidate_id: string
          company_id: string
          created_at?: string
          experience_match?: number | null
          hired_at?: string | null
          id?: string
          interview_completed_at?: string | null
          interview_outcome?: string | null
          interview_scheduled_at?: string | null
          interview_scheduling_state?: string
          match_score?: number
          message?: string | null
          notes?: string | null
          position_title?: string | null
          reached_out_at?: string | null
          recruiter_id: string
          recruiter_search_id?: string | null
          recruiter_user_id?: string | null
          role_title?: string | null
          skills_match?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["job_match_status"]
          student_user_id?: string | null
          updated_at?: string
        }
        Update: {
          availability_match?: number | null
          candidate_id?: string
          company_id?: string
          created_at?: string
          experience_match?: number | null
          hired_at?: string | null
          id?: string
          interview_completed_at?: string | null
          interview_outcome?: string | null
          interview_scheduled_at?: string | null
          interview_scheduling_state?: string
          match_score?: number
          message?: string | null
          notes?: string | null
          position_title?: string | null
          reached_out_at?: string | null
          recruiter_id?: string
          recruiter_search_id?: string | null
          recruiter_user_id?: string | null
          role_title?: string | null
          skills_match?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["job_match_status"]
          student_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_with_open_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_matches_recruiter_search_id_fkey"
            columns: ["recruiter_search_id"]
            isOneToOne: false
            referencedRelation: "recruiter_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_recruiter_user_id_fkey"
            columns: ["recruiter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_recruiter_user_id_fkey"
            columns: ["recruiter_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_matches_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_feedback: {
        Row: {
          created_at: string
          feedback_kind: string
          feedback_text: string | null
          id: string
          lesson_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          feedback_kind: string
          feedback_text?: string | null
          id?: string
          lesson_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          feedback_kind?: string
          feedback_text?: string | null
          id?: string
          lesson_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_feedback_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_availability_slots: {
        Row: {
          alumnus_id: string
          created_at: string
          id: string
          is_blocked: boolean
          recurrence_rule: string | null
          slot_end: string
          slot_start: string
        }
        Insert: {
          alumnus_id: string
          created_at?: string
          id?: string
          is_blocked?: boolean
          recurrence_rule?: string | null
          slot_end: string
          slot_start: string
        }
        Update: {
          alumnus_id?: string
          created_at?: string
          id?: string
          is_blocked?: boolean
          recurrence_rule?: string | null
          slot_end?: string
          slot_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_availability_slots_alumnus_id_fkey"
            columns: ["alumnus_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_availability_slots_alumnus_id_fkey"
            columns: ["alumnus_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_feedback: {
        Row: {
          created_at: string
          feedback_text: string | null
          id: string
          no_show_flag: boolean
          rating: number | null
          session_id: string
          subject_id: string
          submitter_id: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          no_show_flag?: boolean
          rating?: number | null
          session_id: string
          subject_id: string
          submitter_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          no_show_flag?: boolean
          rating?: number | null
          session_id?: string
          subject_id?: string
          submitter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mentor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_feedback_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_feedback_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mentor_feedback_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_feedback_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_requests: {
        Row: {
          alumnus_id: string
          created_at: string
          id: string
          intro_text: string
          responded_at: string | null
          slot_id: string
          status: string
          student_id: string
        }
        Insert: {
          alumnus_id: string
          created_at?: string
          id?: string
          intro_text: string
          responded_at?: string | null
          slot_id: string
          status?: string
          student_id: string
        }
        Update: {
          alumnus_id?: string
          created_at?: string
          id?: string
          intro_text?: string
          responded_at?: string | null
          slot_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_requests_alumnus_id_fkey"
            columns: ["alumnus_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_requests_alumnus_id_fkey"
            columns: ["alumnus_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mentor_requests_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "mentor_availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_sessions: {
        Row: {
          alumnus_id: string
          completed_at: string | null
          created_at: string
          id: string
          joined_at: string | null
          request_id: string
          scheduled_end: string
          scheduled_start: string
          status: string
          student_id: string
          video_provider: string | null
          video_room_url: string | null
        }
        Insert: {
          alumnus_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          joined_at?: string | null
          request_id: string
          scheduled_end: string
          scheduled_start: string
          status?: string
          student_id: string
          video_provider?: string | null
          video_room_url?: string | null
        }
        Update: {
          alumnus_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          joined_at?: string | null
          request_id?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          student_id?: string
          video_provider?: string | null
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_sessions_alumnus_id_fkey"
            columns: ["alumnus_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_sessions_alumnus_id_fkey"
            columns: ["alumnus_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mentor_sessions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "mentor_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_suggestions: {
        Row: {
          consumed_at: string | null
          id: string
          student_id: string
          suggested_alumni_ids: string[]
          topic: string
          triggered_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          consumed_at?: string | null
          id?: string
          student_id: string
          suggested_alumni_ids: string[]
          topic: string
          triggered_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          consumed_at?: string | null
          id?: string
          student_id?: string
          suggested_alumni_ids?: string[]
          topic?: string
          triggered_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mock_interview_turns: {
        Row: {
          content: string
          created_at: string
          id: string
          interview_id: string
          role: string
          tokens_used: number
          turn_index: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          interview_id: string
          role: string
          tokens_used?: number
          turn_index: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          interview_id?: string
          role?: string
          tokens_used?: number
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_interview_turns_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "mock_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_interviews: {
        Row: {
          completed_at: string | null
          id: string
          rubric: Json | null
          score_contribution: number | null
          started_at: string
          status: string
          student_id: string
          topic: string
          total_tokens: number
        }
        Insert: {
          completed_at?: string | null
          id?: string
          rubric?: Json | null
          score_contribution?: number | null
          started_at?: string
          status?: string
          student_id: string
          topic: string
          total_tokens?: number
        }
        Update: {
          completed_at?: string | null
          id?: string
          rubric?: Json | null
          score_contribution?: number | null
          started_at?: string
          status?: string
          student_id?: string
          topic?: string
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_interviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_interviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      next_best_skills: {
        Row: {
          computed_at: string
          confidence: number
          id: string
          rank: number
          reasoning: string
          skill: string
          source_count: number
          student_id: string
        }
        Insert: {
          computed_at?: string
          confidence: number
          id?: string
          rank: number
          reasoning: string
          skill: string
          source_count: number
          student_id: string
        }
        Update: {
          computed_at?: string
          confidence?: number
          id?: string
          rank?: number
          reasoning?: string
          skill?: string
          source_count?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_best_skills_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_skills_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dispatched_at: string | null
          dispatched_channel: string | null
          dispatched_status: string | null
          href: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dispatched_at?: string | null
          dispatched_channel?: string | null
          dispatched_status?: string | null
          href?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dispatched_at?: string | null
          dispatched_channel?: string | null
          dispatched_status?: string | null
          href?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      nudge_preferences: {
        Row: {
          channel_priority: string
          daily_send_local_time: string
          dashboard_channel: boolean
          pause_all: boolean
          push_channel: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          real_time_peak_nudges: boolean
          streak_risk_nudges: boolean
          timezone: string
          updated_at: string
          user_id: string
          weekly_send_local_day: number
          weekly_send_local_time: string
          whatsapp_channel: boolean
          whatsapp_premium_opt_in: boolean
        }
        Insert: {
          channel_priority?: string
          daily_send_local_time?: string
          dashboard_channel?: boolean
          pause_all?: boolean
          push_channel?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          real_time_peak_nudges?: boolean
          streak_risk_nudges?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_send_local_day?: number
          weekly_send_local_time?: string
          whatsapp_channel?: boolean
          whatsapp_premium_opt_in?: boolean
        }
        Update: {
          channel_priority?: string
          daily_send_local_time?: string
          dashboard_channel?: boolean
          pause_all?: boolean
          push_channel?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          real_time_peak_nudges?: boolean
          streak_risk_nudges?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_send_local_day?: number
          weekly_send_local_time?: string
          whatsapp_channel?: boolean
          whatsapp_premium_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "nudge_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      nudge_responses: {
        Row: {
          channel: Database["public"]["Enums"]["nudge_channel"]
          command: Database["public"]["Enums"]["nudge_command"] | null
          id: string
          nudge_id: string
          raw_text: string | null
          received_at: string
          response_kind: Database["public"]["Enums"]["nudge_response_kind"]
          state_change: Json | null
          target_url: string | null
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["nudge_channel"]
          command?: Database["public"]["Enums"]["nudge_command"] | null
          id?: string
          nudge_id: string
          raw_text?: string | null
          received_at?: string
          response_kind: Database["public"]["Enums"]["nudge_response_kind"]
          state_change?: Json | null
          target_url?: string | null
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["nudge_channel"]
          command?: Database["public"]["Enums"]["nudge_command"] | null
          id?: string
          nudge_id?: string
          raw_text?: string | null
          received_at?: string
          response_kind?: Database["public"]["Enums"]["nudge_response_kind"]
          state_change?: Json | null
          target_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudge_responses_nudge_id_fkey"
            columns: ["nudge_id"]
            isOneToOne: false
            referencedRelation: "nudges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      nudges: {
        Row: {
          channel: Database["public"]["Enums"]["nudge_channel"]
          created_at: string
          delivery_status: Database["public"]["Enums"]["nudge_delivery_status"]
          failure_reason: string | null
          id: string
          personalization_context: Json | null
          rendered_body: string | null
          send_after: string
          sent_at: string | null
          template_id: string
          trigger_source: Database["public"]["Enums"]["nudge_trigger_source"]
          type: Database["public"]["Enums"]["nudge_type"]
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["nudge_channel"]
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["nudge_delivery_status"]
          failure_reason?: string | null
          id?: string
          personalization_context?: Json | null
          rendered_body?: string | null
          send_after: string
          sent_at?: string | null
          template_id: string
          trigger_source: Database["public"]["Enums"]["nudge_trigger_source"]
          type: Database["public"]["Enums"]["nudge_type"]
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["nudge_channel"]
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["nudge_delivery_status"]
          failure_reason?: string | null
          id?: string
          personalization_context?: Json | null
          rendered_body?: string | null
          send_after?: string
          sent_at?: string | null
          template_id?: string
          trigger_source?: Database["public"]["Enums"]["nudge_trigger_source"]
          type?: Database["public"]["Enums"]["nudge_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      outcome_billing_events: {
        Row: {
          amount: number
          confirmed_at: string
          contract_id: string
          currency: string
          dispute_reason: string | null
          disputed: boolean
          id: string
          offer_id: string
          reversed_at: string | null
          student_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string
          contract_id: string
          currency: string
          dispute_reason?: string | null
          disputed?: boolean
          id?: string
          offer_id: string
          reversed_at?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string
          contract_id?: string
          currency?: string
          dispute_reason?: string | null
          disputed?: boolean
          id?: string
          offer_id?: string
          reversed_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcome_billing_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "outcome_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_billing_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "student_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_billing_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_billing_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      outcome_contracts: {
        Row: {
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          institution_id: string
          rate_per_placement: number
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          institution_id: string
          rate_per_placement: number
          started_at: string
          status?: string
        }
        Update: {
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          institution_id?: string
          rate_per_placement?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcome_contracts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      peak_window_inferences: {
        Row: {
          biometric_inputs_hash: string | null
          confidence: number
          created_at: string
          detector_inputs_hash: string
          id: string
          ide_inputs_hash: string | null
          source_mix: Json
          student_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          biometric_inputs_hash?: string | null
          confidence: number
          created_at?: string
          detector_inputs_hash: string
          id?: string
          ide_inputs_hash?: string | null
          source_mix?: Json
          student_id: string
          window_end: string
          window_start: string
        }
        Update: {
          biometric_inputs_hash?: string | null
          confidence?: number
          created_at?: string
          detector_inputs_hash?: string
          id?: string
          ide_inputs_hash?: string | null
          source_mix?: Json
          student_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "peak_window_inferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peak_window_inferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      placement_predictions: {
        Row: {
          company_tier: Database["public"]["Enums"]["prediction_company_tier"]
          computed_at: string
          id: string
          input_features: Json | null
          model_version: string
          probability_0_100: number
          run_week: string
          time_to_ready_months: number | null
          top_gaps: Json | null
          user_id: string
        }
        Insert: {
          company_tier: Database["public"]["Enums"]["prediction_company_tier"]
          computed_at?: string
          id?: string
          input_features?: Json | null
          model_version: string
          probability_0_100: number
          run_week: string
          time_to_ready_months?: number | null
          top_gaps?: Json | null
          user_id: string
        }
        Update: {
          company_tier?: Database["public"]["Enums"]["prediction_company_tier"]
          computed_at?: string
          id?: string
          input_features?: Json | null
          model_version?: string
          probability_0_100?: number
          run_week?: string
          time_to_ready_months?: number | null
          top_gaps?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          completed_at: string | null
          details: Json | null
          id: string
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          requested_at: string
          status: Database["public"]["Enums"]["privacy_request_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json | null
          id?: string
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          requested_at?: string
          status?: Database["public"]["Enums"]["privacy_request_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          details?: Json | null
          id?: string
          request_type?: Database["public"]["Enums"]["privacy_request_type"]
          requested_at?: string
          status?: Database["public"]["Enums"]["privacy_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          capacity: number
          created_at: string
          id: string
          last_refill_at: string
          refill_per_second: number
          tokens: number
        }
        Insert: {
          bucket_key: string
          capacity: number
          created_at?: string
          id?: string
          last_refill_at?: string
          refill_per_second: number
          tokens?: number
        }
        Update: {
          bucket_key?: string
          capacity?: number
          created_at?: string
          id?: string
          last_refill_at?: string
          refill_per_second?: number
          tokens?: number
        }
        Relationships: []
      }
      recruiter_chat_session: {
        Row: {
          ended_at: string | null
          id: string
          last_activity_at: string
          question_count: number
          recruiter_id: string
          started_at: string
          student_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          last_activity_at?: string
          question_count?: number
          recruiter_id: string
          started_at?: string
          student_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          last_activity_at?: string
          question_count?: number
          recruiter_id?: string
          started_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_chat_session_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_chat_session_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recruiter_chat_session_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_chat_session_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      recruiter_searches: {
        Row: {
          batch_years: Json | null
          company_id: string
          created_at: string
          filters: Json | null
          id: string
          last_results_count: number | null
          last_run_at: string | null
          locations: Json | null
          min_skill_proof_score: number | null
          recruiter_id: string
          recruiter_user_id: string | null
          results_count: number
          search_name: string
          skill_filters: Json | null
          updated_at: string
        }
        Insert: {
          batch_years?: Json | null
          company_id: string
          created_at?: string
          filters?: Json | null
          id?: string
          last_results_count?: number | null
          last_run_at?: string | null
          locations?: Json | null
          min_skill_proof_score?: number | null
          recruiter_id: string
          recruiter_user_id?: string | null
          results_count?: number
          search_name: string
          skill_filters?: Json | null
          updated_at?: string
        }
        Update: {
          batch_years?: Json | null
          company_id?: string
          created_at?: string
          filters?: Json | null
          id?: string
          last_results_count?: number | null
          last_run_at?: string | null
          locations?: Json | null
          min_skill_proof_score?: number | null
          recruiter_id?: string
          recruiter_user_id?: string | null
          results_count?: number
          search_name?: string
          skill_filters?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_searches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_searches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_with_open_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_searches_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_searches_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recruiter_searches_recruiter_user_id_fkey"
            columns: ["recruiter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_searches_recruiter_user_id_fkey"
            columns: ["recruiter_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sessions: {
        Row: {
          category: Database["public"]["Enums"]["session_category"]
          client_id: string | null
          created_at: string
          distraction_seconds: number | null
          duration_minutes: number | null
          ended_at: string | null
          extension_version: string | null
          extensions_used: Json | null
          focus_level: Database["public"]["Enums"]["focus_level"]
          focus_score: number | null
          id: string
          notes: string | null
          project_name: string | null
          quality_rating: number | null
          started_at: string
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          tab_switches: number | null
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["session_category"]
          client_id?: string | null
          created_at?: string
          distraction_seconds?: number | null
          duration_minutes?: number | null
          ended_at?: string | null
          extension_version?: string | null
          extensions_used?: Json | null
          focus_level?: Database["public"]["Enums"]["focus_level"]
          focus_score?: number | null
          id?: string
          notes?: string | null
          project_name?: string | null
          quality_rating?: number | null
          started_at: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          tab_switches?: number | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["session_category"]
          client_id?: string | null
          created_at?: string
          distraction_seconds?: number | null
          duration_minutes?: number | null
          ended_at?: string | null
          extension_version?: string | null
          extensions_used?: Json | null
          focus_level?: Database["public"]["Enums"]["focus_level"]
          focus_score?: number | null
          id?: string
          notes?: string | null
          project_name?: string | null
          quality_rating?: number | null
          started_at?: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          tab_switches?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      signal_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          aggregate_hash: string | null
          byte_count: number
          created_at: string
          id: number
          payload_redacted: boolean
          provider: string
          student_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          aggregate_hash?: string | null
          byte_count?: number
          created_at?: string
          id?: number
          payload_redacted?: boolean
          provider: string
          student_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          aggregate_hash?: string | null
          byte_count?: number
          created_at?: string
          id?: number
          payload_redacted?: boolean
          provider?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "signal_audit_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_audit_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      skill_trajectory_embeddings: {
        Row: {
          embedding: string
          event_count: number
          last_computed_at: string
          model_version: string
          user_id: string
        }
        Insert: {
          embedding: string
          event_count: number
          last_computed_at?: string
          model_version?: string
          user_id: string
        }
        Update: {
          embedding?: string
          event_count?: number
          last_computed_at?: string
          model_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_trajectory_embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_trajectory_embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      skills: {
        Row: {
          avg_hours_to_proficiency: number | null
          category: string
          created_at: string
          description: string | null
          difficulty_level: number
          id: string
          industry_demand: number
          name: string
          slug: string
        }
        Insert: {
          avg_hours_to_proficiency?: number | null
          category: string
          created_at?: string
          description?: string | null
          difficulty_level: number
          id?: string
          industry_demand: number
          name: string
          slug: string
        }
        Update: {
          avg_hours_to_proficiency?: number | null
          category?: string
          created_at?: string
          description?: string | null
          difficulty_level?: number
          id?: string
          industry_demand?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      slug_redirects: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          new_slug: string
          old_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          new_slug: string
          old_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          new_slug?: string
          old_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slug_redirects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slug_redirects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sso_connections: {
        Row: {
          created_at: string
          id: string
          idp_type: string | null
          institution_id: string
          status: string
          workos_connection_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idp_type?: string | null
          institution_id: string
          status?: string
          workos_connection_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idp_type?: string | null
          institution_id?: string
          status?: string
          workos_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_connections_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      status_incidents: {
        Row: {
          affected_subsystems: string[]
          id: string
          resolved_at: string | null
          started_at: string
          status: string
          summary: string | null
          title: string
        }
        Insert: {
          affected_subsystems?: string[]
          id: string
          resolved_at?: string | null
          started_at?: string
          status: string
          summary?: string | null
          title: string
        }
        Update: {
          affected_subsystems?: string[]
          id?: string
          resolved_at?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      status_scheduled_maintenances: {
        Row: {
          affected_subsystems: string[]
          description: string | null
          ends_at: string
          id: string
          starts_at: string
          title: string
        }
        Insert: {
          affected_subsystems?: string[]
          description?: string | null
          ends_at: string
          id: string
          starts_at: string
          title: string
        }
        Update: {
          affected_subsystems?: string[]
          description?: string | null
          ends_at?: string
          id?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      student_applications: {
        Row: {
          applied_at: string
          company_id: string
          credential_snapshot_id: string
          id: string
          status: Database["public"]["Enums"]["application_status"]
          student_user_id: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          company_id: string
          credential_snapshot_id: string
          id?: string
          status?: Database["public"]["Enums"]["application_status"]
          student_user_id: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          company_id?: string
          credential_snapshot_id?: string
          id?: string
          status?: Database["public"]["Enums"]["application_status"]
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_with_open_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_applications_credential_snapshot_id_fkey"
            columns: ["credential_snapshot_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_applications_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_applications_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      talent_twin_chunks: {
        Row: {
          chunk_type: string
          content: string
          created_at: string
          embedding: string
          id: string
          metadata: Json
          source_id: string
          source_url: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          chunk_type: string
          content: string
          created_at?: string
          embedding: string
          id?: string
          metadata?: Json
          source_id: string
          source_url?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          chunk_type?: string
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          metadata?: Json
          source_id?: string
          source_url?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_twin_chunks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_twin_chunks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      talent_twin_qa_log: {
        Row: {
          answer_hash: string
          chat_session_id: string | null
          citation_links: Json
          created_at: string
          id: number
          latency_ms: number | null
          question_hash: string
          recruiter_id: string
          status: string
          student_id: string
        }
        Insert: {
          answer_hash: string
          chat_session_id?: string | null
          citation_links?: Json
          created_at?: string
          id?: number
          latency_ms?: number | null
          question_hash: string
          recruiter_id: string
          status?: string
          student_id: string
        }
        Update: {
          answer_hash?: string
          chat_session_id?: string | null
          citation_links?: Json
          created_at?: string
          id?: number
          latency_ms?: number | null
          question_hash?: string
          recruiter_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_twin_qa_log_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "recruiter_chat_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_twin_qa_log_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_twin_qa_log_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "talent_twin_qa_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_twin_qa_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      teamwork_scores: {
        Row: {
          breakdown_json: Json
          computed_at: string
          id: string
          room_id: string
          score: number
          sub_scores_json: Json
          user_id: string | null
        }
        Insert: {
          breakdown_json: Json
          computed_at?: string
          id?: string
          room_id: string
          score: number
          sub_scores_json: Json
          user_id?: string | null
        }
        Update: {
          breakdown_json?: Json
          computed_at?: string
          id?: string
          room_id?: string
          score?: number
          sub_scores_json?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teamwork_scores_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teamwork_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teamwork_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_dsa_profiles: {
        Row: {
          anticheat_score: number | null
          badges: Json
          contest_rating: number | null
          created_at: string
          easy_solved: number
          hard_solved: number
          id: string
          last_active_at: string | null
          last_synced_at: string
          medium_solved: number
          platform: string
          quarantined_at: string | null
          streak_days: number
          sync_status: string
          total_solved: number
          user_id: string
          username: string
        }
        Insert: {
          anticheat_score?: number | null
          badges?: Json
          contest_rating?: number | null
          created_at?: string
          easy_solved?: number
          hard_solved?: number
          id?: string
          last_active_at?: string | null
          last_synced_at?: string
          medium_solved?: number
          platform: string
          quarantined_at?: string | null
          streak_days?: number
          sync_status?: string
          total_solved?: number
          user_id: string
          username: string
        }
        Update: {
          anticheat_score?: number | null
          badges?: Json
          contest_rating?: number | null
          created_at?: string
          easy_solved?: number
          hard_solved?: number
          id?: string
          last_active_at?: string | null
          last_synced_at?: string
          medium_solved?: number
          platform?: string
          quarantined_at?: string | null
          streak_days?: number
          sync_status?: string
          total_solved?: number
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dsa_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dsa_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_skills: {
        Row: {
          avg_completion_rate: number | null
          avg_focus_quality: number | null
          consistency_score: number | null
          created_at: string
          hours_logged: number
          hours_score: number | null
          id: string
          last_calculated_at: string | null
          last_project_date: string | null
          proficiency_level: Database["public"]["Enums"]["proficiency_level"]
          projects_completed: number
          projects_score: number | null
          quality_score: number | null
          skill_id: string
          skill_proof_score: number
          updated_at: string
          user_id: string
          validated_by_institution: boolean
        }
        Insert: {
          avg_completion_rate?: number | null
          avg_focus_quality?: number | null
          consistency_score?: number | null
          created_at?: string
          hours_logged?: number
          hours_score?: number | null
          id?: string
          last_calculated_at?: string | null
          last_project_date?: string | null
          proficiency_level?: Database["public"]["Enums"]["proficiency_level"]
          projects_completed?: number
          projects_score?: number | null
          quality_score?: number | null
          skill_id: string
          skill_proof_score?: number
          updated_at?: string
          user_id: string
          validated_by_institution?: boolean
        }
        Update: {
          avg_completion_rate?: number | null
          avg_focus_quality?: number | null
          consistency_score?: number | null
          created_at?: string
          hours_logged?: number
          hours_score?: number | null
          id?: string
          last_calculated_at?: string | null
          last_project_date?: string | null
          proficiency_level?: Database["public"]["Enums"]["proficiency_level"]
          projects_completed?: number
          projects_score?: number | null
          quality_score?: number | null
          skill_id?: string
          skill_proof_score?: number
          updated_at?: string
          user_id?: string
          validated_by_institution?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          collab_opt_out: boolean
          company_search_visible: boolean
          created_at: string
          custodial_address_index: number | null
          deletion_purge_after: string | null
          deletion_requested_at: string | null
          display_name: string | null
          email: string
          full_name: string | null
          goals: Json | null
          id: string
          last_active_at: string | null
          locale: string
          location: string | null
          onboarding_completed_at: string | null
          onboarding_step: string
          onchain_mirror_opt_in: boolean
          placement_outcome: string | null
          placement_prediction_current_id: string | null
          placement_tier: string | null
          power_mode_active: boolean
          power_mode_badge_shown_at: string | null
          role: Database["public"]["Enums"]["platform_role"]
          salary_band: string | null
          salary_band_shared: boolean
          skill_level: Database["public"]["Enums"]["skill_level"] | null
          talent_twin_opt_in: boolean
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
          verifiable_credential_id: string | null
          wallet_address: string | null
          whatsapp_opt_in: boolean
          working_hours_end: number | null
          working_hours_start: number | null
        }
        Insert: {
          avatar_url?: string | null
          collab_opt_out?: boolean
          company_search_visible?: boolean
          created_at?: string
          custodial_address_index?: number | null
          deletion_purge_after?: string | null
          deletion_requested_at?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          goals?: Json | null
          id: string
          last_active_at?: string | null
          locale?: string
          location?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: string
          onchain_mirror_opt_in?: boolean
          placement_outcome?: string | null
          placement_prediction_current_id?: string | null
          placement_tier?: string | null
          power_mode_active?: boolean
          power_mode_badge_shown_at?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          salary_band?: string | null
          salary_band_shared?: boolean
          skill_level?: Database["public"]["Enums"]["skill_level"] | null
          talent_twin_opt_in?: boolean
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          verifiable_credential_id?: string | null
          wallet_address?: string | null
          whatsapp_opt_in?: boolean
          working_hours_end?: number | null
          working_hours_start?: number | null
        }
        Update: {
          avatar_url?: string | null
          collab_opt_out?: boolean
          company_search_visible?: boolean
          created_at?: string
          custodial_address_index?: number | null
          deletion_purge_after?: string | null
          deletion_requested_at?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          goals?: Json | null
          id?: string
          last_active_at?: string | null
          locale?: string
          location?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: string
          onchain_mirror_opt_in?: boolean
          placement_outcome?: string | null
          placement_prediction_current_id?: string | null
          placement_tier?: string | null
          power_mode_active?: boolean
          power_mode_badge_shown_at?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          salary_band?: string | null
          salary_band_shared?: boolean
          skill_level?: Database["public"]["Enums"]["skill_level"] | null
          talent_twin_opt_in?: boolean
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          verifiable_credential_id?: string | null
          wallet_address?: string | null
          whatsapp_opt_in?: boolean
          working_hours_end?: number | null
          working_hours_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "users_placement_prediction_current_id_fkey"
            columns: ["placement_prediction_current_id"]
            isOneToOne: false
            referencedRelation: "placement_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_verifiable_credential_id_fkey"
            columns: ["verifiable_credential_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      vc_issuer_keys: {
        Row: {
          alg: string
          created_at: string
          kid: string
          private_key_encrypted: string | null
          public_key: string
        }
        Insert: {
          alg: string
          created_at?: string
          kid: string
          private_key_encrypted?: string | null
          public_key: string
        }
        Update: {
          alg?: string
          created_at?: string
          kid?: string
          private_key_encrypted?: string | null
          public_key?: string
        }
        Relationships: []
      }
      vc_revocations: {
        Row: {
          credential_id: string
          id: string
          reason: string | null
          revoked_at: string
        }
        Insert: {
          credential_id: string
          id?: string
          reason?: string | null
          revoked_at?: string
        }
        Update: {
          credential_id?: string
          id?: string
          reason?: string | null
          revoked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vc_revocations_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "verifiable_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      verifiable_credentials: {
        Row: {
          did: string | null
          expiration_date: string | null
          id: string
          issuance_date: string | null
          issued_at: string
          issuer_did: string
          last_verified_at: string | null
          public_slug: string
          revocation_status: Database["public"]["Enums"]["revocation_status"]
          revoked_at: string | null
          snapshot_activity_totals: Json | null
          snapshot_cohort_percentile: number | null
          snapshot_overall_score: number
          snapshot_per_skill: Json | null
          snapshot_taken_at: string
          updated_at: string
          user_id: string
          vc_document: Json | null
          vc_proof: Json | null
          verification_count: number
        }
        Insert: {
          did?: string | null
          expiration_date?: string | null
          id?: string
          issuance_date?: string | null
          issued_at?: string
          issuer_did?: string
          last_verified_at?: string | null
          public_slug: string
          revocation_status?: Database["public"]["Enums"]["revocation_status"]
          revoked_at?: string | null
          snapshot_activity_totals?: Json | null
          snapshot_cohort_percentile?: number | null
          snapshot_overall_score: number
          snapshot_per_skill?: Json | null
          snapshot_taken_at: string
          updated_at?: string
          user_id: string
          vc_document?: Json | null
          vc_proof?: Json | null
          verification_count?: number
        }
        Update: {
          did?: string | null
          expiration_date?: string | null
          id?: string
          issuance_date?: string | null
          issued_at?: string
          issuer_did?: string
          last_verified_at?: string | null
          public_slug?: string
          revocation_status?: Database["public"]["Enums"]["revocation_status"]
          revoked_at?: string | null
          snapshot_activity_totals?: Json | null
          snapshot_cohort_percentile?: number | null
          snapshot_overall_score?: number
          snapshot_per_skill?: Json | null
          snapshot_taken_at?: string
          updated_at?: string
          user_id?: string
          vc_document?: Json | null
          vc_proof?: Json | null
          verification_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "verifiable_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifiable_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          attempt_number: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string | null
          error_message: string | null
          event_id: string
          event_type: string | null
          id: number
          last_error: string | null
          payload: Json | null
          requested_at: string
          responded_at: string | null
          response_body_excerpt: string | null
          response_status: number | null
          status: string
          subscription_id: string
        }
        Insert: {
          attempt?: number
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string | null
          error_message?: string | null
          event_id: string
          event_type?: string | null
          id?: number
          last_error?: string | null
          payload?: Json | null
          requested_at?: string
          responded_at?: string | null
          response_body_excerpt?: string | null
          response_status?: number | null
          status?: string
          subscription_id: string
        }
        Update: {
          attempt?: number
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string | null
          id?: number
          last_error?: string | null
          payload?: Json | null
          requested_at?: string
          responded_at?: string | null
          response_body_excerpt?: string | null
          response_status?: number | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          consecutive_failures: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_success_at: string | null
          owner_type: string
          owner_user_id: string
          secret: string
          subscribed_events: string[]
          url: string
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          owner_type: string
          owner_user_id: string
          secret: string
          subscribed_events?: string[]
          url: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          owner_type?: string
          owner_user_id?: string
          secret?: string
          subscribed_events?: string[]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      webhook_event_types: {
        Row: {
          description: string
          event_type: string
          schema: Json
        }
        Insert: {
          description: string
          event_type: string
          schema: Json
        }
        Update: {
          description?: string
          event_type?: string
          schema?: Json
        }
        Relationships: []
      }
      webhook_subscriptions: {
        Row: {
          active: boolean
          api_key_id: string
          created_at: string
          event: string
          id: string
          secret_hash: string
          target_url: string
        }
        Insert: {
          active?: boolean
          api_key_id: string
          created_at?: string
          event: string
          id?: string
          secret_hash: string
          target_url: string
        }
        Update: {
          active?: boolean
          api_key_id?: string
          created_at?: string
          event?: string
          id?: string
          secret_hash?: string
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_subscriptions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          created_at: string
          id: string
          last_delivery_at: string | null
          last_error: string | null
          opt_in_at: string
          opt_out_at: string | null
          phone_number: string
          provider: Database["public"]["Enums"]["whatsapp_provider"]
          provider_phone_id: string | null
          status: Database["public"]["Enums"]["whatsapp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_delivery_at?: string | null
          last_error?: string | null
          opt_in_at: string
          opt_out_at?: string | null
          phone_number: string
          provider?: Database["public"]["Enums"]["whatsapp_provider"]
          provider_phone_id?: string | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_delivery_at?: string | null
          last_error?: string | null
          opt_in_at?: string
          opt_out_at?: string | null
          phone_number?: string
          provider?: Database["public"]["Enums"]["whatsapp_provider"]
          provider_phone_id?: string | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      api_keys_safe: {
        Row: {
          created_at: string | null
          id: string | null
          key_prefix: string | null
          last_used_at: string | null
          name: string | null
          rate_limit_rpm: number | null
          revoked_at: string | null
          scopes: string[] | null
          subject_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string | null
          rate_limit_rpm?: number | null
          revoked_at?: string | null
          scopes?: string[] | null
          subject_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string | null
          rate_limit_rpm?: number | null
          revoked_at?: string | null
          scopes?: string[] | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "v_power_mode_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      companies_with_open_positions: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          id: string | null
          industry: string | null
          location: string | null
          logo_url: string | null
          min_skill_proof_score: number | null
          monthly_cost: number | null
          name: string | null
          open_positions_count: number | null
          preferred_batch_years: Json | null
          preferred_locations: Json | null
          skill_preferences: Json | null
          subscription_start_date: string | null
          subscription_tier: Database["public"]["Enums"]["company_tier"] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          min_skill_proof_score?: number | null
          monthly_cost?: number | null
          name?: string | null
          open_positions_count?: never
          preferred_batch_years?: Json | null
          preferred_locations?: Json | null
          skill_preferences?: Json | null
          subscription_start_date?: string | null
          subscription_tier?: Database["public"]["Enums"]["company_tier"] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          min_skill_proof_score?: number | null
          monthly_cost?: number | null
          name?: string | null
          open_positions_count?: never
          preferred_batch_years?: Json | null
          preferred_locations?: Json | null
          skill_preferences?: Json | null
          subscription_start_date?: string | null
          subscription_tier?: Database["public"]["Enums"]["company_tier"] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      daily_chain_mirror_metrics: {
        Row: {
          day: string | null
          dead_letter_count: number | null
          failed_count: number | null
          median_cost_usd: number | null
          mirror_count: number | null
          p95_cost_usd: number | null
          unmirror_count: number | null
        }
        Relationships: []
      }
      v_power_mode_status: {
        Row: {
          declared_active: boolean | null
          last_heartbeat_at: string | null
          power_mode_active: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      build_vc_document: { Args: { p_credential_id: string }; Returns: Json }
      calculate_skill_proof_score: {
        Args: {
          p_avg_completion_rate: number
          p_avg_focus_quality: number
          p_consistency_score: number
          p_hours_logged: number
          p_hours_score: number
          p_projects_completed: number
          p_projects_score: number
          p_quality_score: number
        }
        Returns: number
      }
      cohort_aggregate: { Args: { p_cohort_id: string }; Returns: Json }
      cohort_compare: {
        Args: { p_cohort_id: string; p_user_id: string }
        Returns: Json
      }
      cron_calendar_sync: { Args: never; Returns: undefined }
      cron_dsa_sync: { Args: never; Returns: undefined }
      cron_generate_insights: { Args: never; Returns: undefined }
      cron_github_sync: { Args: never; Returns: undefined }
      cron_nudge_dispatch_extended: { Args: never; Returns: undefined }
      cron_update_profiles: { Args: never; Returns: undefined }
      delete_student_chunks: { Args: { p_user_id: string }; Returns: undefined }
      ensure_user_skill_row: {
        Args: { p_skill_id: string; p_user_id: string }
        Returns: undefined
      }
      insert_twin_chunk: {
        Args: {
          p_chunk_type: string
          p_content: string
          p_embedding: string
          p_metadata?: Json
          p_source_id: string
          p_source_url?: string
          p_title?: string
          p_user_id: string
        }
        Returns: string
      }
      is_collab_host: { Args: { target_room_id: string }; Returns: boolean }
      is_collab_participant: {
        Args: { target_room_id: string }
        Returns: boolean
      }
      is_placement_officer_for: { Args: { inst_id: string }; Returns: boolean }
      is_recruiter_for: { Args: { comp_id: string }; Returns: boolean }
      rate_limit_consume: {
        Args: {
          p_bucket_key: string
          p_capacity: number
          p_cost?: number
          p_refill_per_second: number
        }
        Returns: {
          allowed: boolean
          remaining_tokens: number
          retry_after_seconds: number
        }[]
      }
      rebuild_user_skills: {
        Args: { p_user_id: string }
        Returns: {
          hours_logged: number
          skill_id: string
          skill_proof_score: number
        }[]
      }
      recalculate_candidate_profile: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      recalculate_user_skill: {
        Args: { p_skill_id: string; p_user_id: string }
        Returns: undefined
      }
      resolve_did: { Args: { p_did: string }; Returns: Json }
      score_to_proficiency: {
        Args: { p_score: number }
        Returns: Database["public"]["Enums"]["proficiency_level"]
      }
      search_twin_chunks: {
        Args: {
          p_limit?: number
          p_query_embedding: string
          p_user_ids: string[]
        }
        Returns: {
          chunk_type: string
          content: string
          id: string
          metadata: Json
          similarity: number
          source_url: string
          title: string
          user_id: string
        }[]
      }
      sign_vc_document: {
        Args: { p_credential_id: string; p_kid: string }
        Returns: Json
      }
      trigger_nudge_event: {
        Args: { p_context?: Json; p_event_type: string; p_user_id: string }
        Returns: undefined
      }
      verify_api_key: {
        Args: { p_key: string; p_prefix: string }
        Returns: {
          hash_match: boolean
          id: string
          key_prefix: string
          rate_limit_rpm: number
          scopes: string[]
          subject_id: string
        }[]
      }
      webhook_generate_secret: { Args: never; Returns: string }
    }
    Enums: {
      application_status:
        | "submitted"
        | "viewed_by_company"
        | "interview_proposed"
        | "interview_accepted"
        | "rejected"
        | "withdrawn"
      calendar_account_status: "active" | "disconnected" | "expired"
      calendar_provider: "google" | "microsoft"
      cohort_type: "institutional" | "interest" | "custom"
      company_role: "admin" | "recruiter" | "hiring_manager"
      company_tier: "startup" | "growth" | "enterprise"
      credential_channel: "link" | "pdf" | "qr" | "linkedin_badge"
      exam_window_basis: "keyword_density" | "all_day_blocks" | "manual_flag"
      focus_level: "high" | "medium" | "low"
      github_account_status: "active" | "disconnected" | "expired"
      insight_type:
        | "peak_window"
        | "workflow_pattern"
        | "skill_detection"
        | "productivity_trend"
        | "burnout_risk"
        | "category_success"
      institution_role: "student" | "faculty" | "admin" | "placement_officer"
      institution_tier: "starter" | "growth" | "enterprise"
      institution_type:
        | "college"
        | "university"
        | "bootcamp"
        | "corporate_training"
      interview_slot_status:
        | "proposed"
        | "accepted"
        | "declined"
        | "rescheduled"
        | "completed"
      job_match_status:
        | "matched"
        | "reached_out"
        | "interview_scheduled"
        | "interview_completed"
        | "hired"
        | "rejected"
      nudge_channel: "whatsapp" | "push" | "dashboard"
      nudge_command:
        | "START"
        | "DONE"
        | "STATS"
        | "RANK"
        | "HELP"
        | "PAUSE"
        | "RESUME"
      nudge_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "suppressed_quiet_hours"
        | "suppressed_exam_week"
        | "suppressed_paused"
        | "suppressed_opt_out"
      nudge_response_kind: "command" | "click" | "reply_text"
      nudge_trigger_source:
        | "cron"
        | "event_commit"
        | "event_score_recomputed"
        | "event_calendar_window_opened"
        | "event_exam_detected"
        | "student_reply"
      nudge_type:
        | "daily_morning"
        | "real_time_peak"
        | "streak_risk"
        | "weekly_summary"
        | "verification"
        | "pause_confirmation"
      platform_role: "student" | "placement_officer" | "recruiter" | "admin"
      position_status: "open" | "paused" | "closed"
      prediction_company_tier: "tier_1" | "tier_2" | "tier_3"
      privacy_request_status: "pending" | "in_progress" | "completed" | "failed"
      privacy_request_type:
        | "account_deletion"
        | "company_search_opt_out"
        | "company_search_opt_in"
        | "data_export"
        | "source_disconnect"
      proficiency_level:
        | "novice"
        | "developing"
        | "proficient"
        | "advanced"
        | "expert"
      revocation_status: "active" | "revoked"
      session_category: "dsa" | "coding" | "project" | "learning" | "research"
      skill_level: "beginner" | "intermediate" | "advanced" | "expert"
      user_type: "student" | "professional"
      whatsapp_provider: "meta_cloud" | "twilio"
      whatsapp_status:
        | "active"
        | "paused"
        | "opt_out"
        | "disconnected"
        | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_status: [
        "submitted",
        "viewed_by_company",
        "interview_proposed",
        "interview_accepted",
        "rejected",
        "withdrawn",
      ],
      calendar_account_status: ["active", "disconnected", "expired"],
      calendar_provider: ["google", "microsoft"],
      cohort_type: ["institutional", "interest", "custom"],
      company_role: ["admin", "recruiter", "hiring_manager"],
      company_tier: ["startup", "growth", "enterprise"],
      credential_channel: ["link", "pdf", "qr", "linkedin_badge"],
      exam_window_basis: ["keyword_density", "all_day_blocks", "manual_flag"],
      focus_level: ["high", "medium", "low"],
      github_account_status: ["active", "disconnected", "expired"],
      insight_type: [
        "peak_window",
        "workflow_pattern",
        "skill_detection",
        "productivity_trend",
        "burnout_risk",
        "category_success",
      ],
      institution_role: ["student", "faculty", "admin", "placement_officer"],
      institution_tier: ["starter", "growth", "enterprise"],
      institution_type: [
        "college",
        "university",
        "bootcamp",
        "corporate_training",
      ],
      interview_slot_status: [
        "proposed",
        "accepted",
        "declined",
        "rescheduled",
        "completed",
      ],
      job_match_status: [
        "matched",
        "reached_out",
        "interview_scheduled",
        "interview_completed",
        "hired",
        "rejected",
      ],
      nudge_channel: ["whatsapp", "push", "dashboard"],
      nudge_command: [
        "START",
        "DONE",
        "STATS",
        "RANK",
        "HELP",
        "PAUSE",
        "RESUME",
      ],
      nudge_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "suppressed_quiet_hours",
        "suppressed_exam_week",
        "suppressed_paused",
        "suppressed_opt_out",
      ],
      nudge_response_kind: ["command", "click", "reply_text"],
      nudge_trigger_source: [
        "cron",
        "event_commit",
        "event_score_recomputed",
        "event_calendar_window_opened",
        "event_exam_detected",
        "student_reply",
      ],
      nudge_type: [
        "daily_morning",
        "real_time_peak",
        "streak_risk",
        "weekly_summary",
        "verification",
        "pause_confirmation",
      ],
      platform_role: ["student", "placement_officer", "recruiter", "admin"],
      position_status: ["open", "paused", "closed"],
      prediction_company_tier: ["tier_1", "tier_2", "tier_3"],
      privacy_request_status: ["pending", "in_progress", "completed", "failed"],
      privacy_request_type: [
        "account_deletion",
        "company_search_opt_out",
        "company_search_opt_in",
        "data_export",
        "source_disconnect",
      ],
      proficiency_level: [
        "novice",
        "developing",
        "proficient",
        "advanced",
        "expert",
      ],
      revocation_status: ["active", "revoked"],
      session_category: ["dsa", "coding", "project", "learning", "research"],
      skill_level: ["beginner", "intermediate", "advanced", "expert"],
      user_type: ["student", "professional"],
      whatsapp_provider: ["meta_cloud", "twilio"],
      whatsapp_status: ["active", "paused", "opt_out", "disconnected", "error"],
    },
  },
} as const
