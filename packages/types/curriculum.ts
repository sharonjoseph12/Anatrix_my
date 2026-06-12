import { Database } from './database';

export type CurriculumLesson = Database['public']['Tables']['curriculum_lessons']['Row'];
export type LessonFeedback = Database['public']['Tables']['lesson_feedback']['Row'];
export type CurriculumCostCounter = Database['public']['Tables']['curriculum_cost_counters']['Row'];
export type MentorSuggestion = Database['public']['Tables']['mentor_suggestions']['Row'];

export type LessonFeedbackKind = 'too_easy' | 'too_hard' | 'irrelevant' | 'completed';
