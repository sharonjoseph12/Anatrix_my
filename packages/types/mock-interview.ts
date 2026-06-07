// Mock interview types — mirrors migration 036 (mock_interviews, mock_interview_turns)

export type MockInterviewStatus = "in_progress" | "completed" | "abandoned";

export type MockInterviewTurnRole = "student" | "interviewer";

// Mirrors the `mock_interviews.rubric` JSONB shape in the data model:
//   {"clarity":7,"depth":6,"correctness":8,"summary":"..."}
export interface MockInterviewRubric {
  clarity: number;
  depth: number;
  correctness: number;
  summary: string;
}

export interface MockInterview {
  id: string;
  student_id: string;
  topic: string;
  status: MockInterviewStatus;
  rubric: MockInterviewRubric | null;
  score_contribution: number | null; // 0..100, bounded by weekly cap
  total_tokens: number;
  started_at: string;
  completed_at: string | null;
}

export interface MockInterviewTurn {
  id: string;
  interview_id: string;
  turn_index: number;
  role: MockInterviewTurnRole;
  content: string;
  tokens_used: number;
  created_at: string;
}
