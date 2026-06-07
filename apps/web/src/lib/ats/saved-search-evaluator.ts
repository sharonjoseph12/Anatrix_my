// apps/web/src/lib/ats/saved-search-evaluator.ts
// Pure, deterministic matcher for ATS saved searches vs. candidate rows.
//
// SavedSearchQuery JSON shape (v1):
// {
//   "skills": ["react", "typescript"],        // ANY-match (case-insensitive)
//   "min_score": 75,                          // candidate.skill_proof_score >= 75
//   "verified_only": true,                    // candidate.is_verified === true
//   "graduation_year": 2026,                  // optional exact match
//   "institutions": ["uuid1", "uuid2"]        // optional ANY-match
// }
//
// Unknown fields on the query are ignored (forward-compatible). The matcher
// is intentionally side-effect free so it can run inside an edge function
// cron, a webhook handler, or a unit test without ceremony.

export interface SavedSearchQuery {
  skills?: string[];
  min_score?: number;
  verified_only?: boolean;
  graduation_year?: number;
  institutions?: string[];
}

export interface CandidateRow {
  id: string;
  skill_proof_score: number;
  is_verified: boolean;
  graduation_year: number | null;
  institution_id: string | null;
  skills: string[];
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function skillsOverlap(querySkills: string[], candidateSkills: string[]): boolean {
  if (querySkills.length === 0) return true;
  if (candidateSkills.length === 0) return false;
  const candidateSet = new Set(candidateSkills.map(norm));
  for (const skill of querySkills) {
    if (candidateSet.has(norm(skill))) return true;
  }
  return false;
}

function institutionsMatch(queryInstitutions: string[], candidateInstitution: string | null): boolean {
  if (queryInstitutions.length === 0) return true;
  if (!candidateInstitution) return false;
  const normalized = norm(candidateInstitution);
  for (const inst of queryInstitutions) {
    if (norm(inst) === normalized) return true;
  }
  return false;
}

export function matches(query: SavedSearchQuery, candidate: CandidateRow): boolean {
  if (query.verified_only === true && !candidate.is_verified) return false;

  if (typeof query.min_score === "number" && Number.isFinite(query.min_score)) {
    if (candidate.skill_proof_score < query.min_score) return false;
  }

  if (typeof query.graduation_year === "number" && Number.isFinite(query.graduation_year)) {
    if (candidate.graduation_year !== query.graduation_year) return false;
  }

  if (Array.isArray(query.skills) && query.skills.length > 0) {
    if (!skillsOverlap(query.skills, candidate.skills)) return false;
  }

  if (Array.isArray(query.institutions) && query.institutions.length > 0) {
    if (!institutionsMatch(query.institutions, candidate.institution_id)) return false;
  }

  return true;
}
