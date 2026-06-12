import { Database } from './database';

export type AlumniProfile = Database['public']['Tables']['alumni_profiles']['Row'];
export type MentorAvailabilitySlot = Database['public']['Tables']['mentor_availability_slots']['Row'];
export type MentorRequest = Database['public']['Tables']['mentor_requests']['Row'];
export type MentorSession = Database['public']['Tables']['mentor_sessions']['Row'];
export type MentorFeedback = Database['public']['Tables']['mentor_feedback']['Row'];

export type MentorRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
export type MentorSessionStatus = 'scheduled' | 'joined' | 'completed' | 'no_show' | 'cancelled';
export type VideoProvider = 'livekit' | 'google_meet';

export interface WeeklyTemplateSlot {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  start_local: string; // 'HH:MM'
  end_local: string; // 'HH:MM'
  tz: string;
}
