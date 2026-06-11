export interface TalentTwinChunk {
  id: string;
  userId: string;
  chunkType: "code" | "commit" | "ide_session" | "collab" | "mock_interview" | "faculty_grade" | "dsa_chat" | "curriculum" | "badge";
  sourceId: string;
  sourceUrl: string | null;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TalentTwinQaLog {
  id: number;
  studentId: string;
  recruiterId: string;
  questionHash: string;
  answerHash: string;
  citationLinks: Array<{ number: number; source_url: string; title: string; chunk_type: string }>;
  status: "pending" | "approved" | "rejected" | "revoked";
  latencyMs: number | null;
  createdAt: string;
}

export interface AnswerPreview {
  id: string;
  studentId: string;
  recruiterId: string;
  recruiterQuestion: string;
  llmAnswer: string;
  editedAnswer: string | null;
  citationLinks: Array<{ number: number; source_url: string; title: string; chunk_type: string }>;
  status: "pending" | "approved" | "rejected";
  autoApproveAt: string;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
}

export interface RecruiterChatSession {
  id: string;
  recruiterId: string;
  studentId: string;
  startedAt: string;
  lastActivityAt: string;
  questionCount: number;
  endedAt: string | null;
}
