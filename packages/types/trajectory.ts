import { Database } from './database';

export type SkillTrajectoryEmbedding = Database['public']['Tables']['skill_trajectory_embeddings']['Row'];

export type UserRole = 'student' | 'alumnus' | 'verified_alumnus';

export interface TrajectoryEvent {
  timestamp: string;
  skill: string;
  project?: string;
  score_delta: number;
}
