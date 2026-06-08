// apps/web/src/lib/algorithms/next-best-skill.ts
// 11/10 — Next-Best-Skill recommender (research D10, US3 / FR-NBS-001..005).
//
// Pure-function module. ZERO imports from framework code (no Next, no
// Supabase, no node:crypto). The same algorithm is mirrored inline in
// supabase/functions/next-best-skill/index.ts because Edge Functions
// cannot import from apps/web. Keep the two in sync; the top comment
// on the Edge Function file is the canary for that.
//
// Algorithm (per research D10 + spec FR-NBS-001..005):
//   1. For each alumni A, compute Jaccard(student.current_skills, A.pre).
//   2. Keep alumni with Jaccard >= threshold (default 0.6).
//   3. For each kept A, next_skills = A.post \ student.current_skills.
//   4. Count occurrences of each next_skill across kept alumni.
//   5. Drop skills with count < minSourceCount (default 5).
//   6. Sort by count DESC, then by (placement_company mode) ASC, then
//      by skill ASC for stable tie-breaking. Take top K (default 3).
//   7. confidence = min(0.95, count / kept_count); reasoning =
//      `${count} of ${kept_count} alumni placed at <most common
//      placement_company among those who learned this skill> added
//      <skill> after your current stack`.
//
// Edge cases:
//   - If kept_count === 0, returns [].
//   - If student.current_skills is empty, returns [] (FR-NBS-003 — no
//     low-signal noise on a brand-new profile).

export interface AlumniProfile {
  id: string;
  pre_placement_skills: string[];
  post_placement_skills: string[];
  placement_company: string;
}

export interface StudentProfile {
  id: string;
  current_skills: string[];
}

export interface Recommendation {
  skill: string;
  rank: number;
  source_count: number;
  confidence: number;
  reasoning: string;
}

export interface ComputeOptions {
  minSourceCount?: number;
  jaccardThreshold?: number;
  topK?: number;
}

export function computeRecommendations(
  student: StudentProfile,
  alumni: ReadonlyArray<AlumniProfile>,
  options?: ComputeOptions,
): Recommendation[] {
  const minSourceCount = options?.minSourceCount ?? 5;
  const jaccardThreshold = options?.jaccardThreshold ?? 0.6;
  const topK = options?.topK ?? 3;

  // FR-NBS-003 — no low-signal noise on an empty student stack.
  if (student.current_skills.length === 0) return [];

  // Step 1 + 2: filter alumni by Jaccard similarity threshold.
  const kept = alumni.filter((a) => {
    const j = jaccard(student.current_skills, a.pre_placement_skills);
    return j >= jaccardThreshold;
  });
  if (kept.length === 0) return [];

  // Step 3 + 4: tally next-skill mentions and the companies of the
  // alumni who learned each one. The companies feed the reasoning
  // template (mode of placement_company per skill).
  //
  // "Added after" semantic (spec FR-NBS-001, research D10): a skill
  // only counts if the alumni learned it AFTER their pre-placement
  // profile AND the student does not already have it. Excluding the
  // pre set prevents skills that were always part of the alumni's
  // background from being mis-attributed to "placement uplift".
  const studentSet = new Set(student.current_skills);
  const aggregated = new Map<string, { count: number; companies: string[] }>();
  for (const a of kept) {
    const preSet = new Set(a.pre_placement_skills);
    const next = new Set<string>();
    for (const s of a.post_placement_skills) {
      if (preSet.has(s)) continue;
      if (studentSet.has(s)) continue;
      next.add(s);
    }
    for (const skill of next) {
      const entry = aggregated.get(skill) ?? { count: 0, companies: [] };
      entry.count += 1;
      entry.companies.push(a.placement_company);
      aggregated.set(skill, entry);
    }
  }

  const keptCount = kept.length;

  // Step 5: drop low-signal skills.
  const candidates: Array<{
    skill: string;
    count: number;
    confidence: number;
    reasoning: string;
    tieCompany: string;
  }> = [];
  for (const [skill, entry] of aggregated) {
    if (entry.count < minSourceCount) continue;
    const ratio = entry.count / keptCount;
    const confidence = round2(Math.min(0.95, ratio));
    const company = mode(entry.companies);
    const reasoning =
      `${entry.count} of ${keptCount} alumni placed at ${company} added ${skill} after your current stack`;
    candidates.push({
      skill,
      count: entry.count,
      confidence,
      reasoning,
      tieCompany: company,
    });
  }

  // Step 6: stable sort — count DESC, then tieCompany ASC, then skill ASC.
  candidates.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.tieCompany !== b.tieCompany) {
      return a.tieCompany < b.tieCompany ? -1 : 1;
    }
    if (a.skill !== b.skill) return a.skill < b.skill ? -1 : 1;
    return 0;
  });

  // Step 6 (cont.) + 7: take top K and assign 1-based rank.
  return candidates.slice(0, topK).map((c, i) => ({
    skill: c.skill,
    rank: i + 1,
    source_count: c.count,
    confidence: c.confidence,
    reasoning: c.reasoning,
  }));
}

function jaccard(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let intersection = 0;
  for (const x of A) if (B.has(x)) intersection += 1;
  const union = A.size + B.size - intersection;
  if (union === 0) return 1;
  return intersection / union;
}

// Mode of a list of strings. On a tie, returns the lexically smallest
// value so the output is deterministic across runs.
function mode(items: ReadonlyArray<string>): string {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  let bestCount = 0;
  let bestVal = "";
  for (const [val, c] of counts) {
    if (c > bestCount || (c === bestCount && val < bestVal)) {
      bestCount = c;
      bestVal = val;
    }
  }
  return bestVal;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
