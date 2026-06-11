export interface AuthorshipProof {
  id: string;
  studentId: string;
  projectId: string;
  sessionVector: Record<string, unknown> | null;
  baselineSimilarity: number | null;
  confidenceScore: number | null;
  verifiableCredentialUrl: string | null;
  status: "requested" | "completed" | "failed" | "revoked";
  createdAt: string;
  completedAt: string | null;
}

export interface AuthorshipSandboxSession {
  id: string;
  proofId: string;
  keystrokeTimingVector: { bins: number[]; counts: number[] };
  astDiffSequence: Array<{ nodesAdded: number; nodesRemoved: number; maxDepthDelta: number }>;
  errorRecoveryVector: { count: number; latenciesMs: number[]; meanLatencyMs: number; medianLatencyMs: number };
  durationSeconds: number;
  createdAt: string;
}

export interface BadgeClaims {
  sub: string;
  badgeNonce: string;
  commits: Array<{ sha: string; repo: string; lines: number; date: string; messageSha256: string }>;
  iat: number;
  exp: number;
}

export interface BadgeRevocation {
  id: string;
  badgeNonce: string;
  badgeId: string;
  reason: string | null;
  revokedBy: string;
  createdAt: string;
}
