// apps/web/src/lib/algorithms/faculty-grade-weight.ts
// T-FAC-001 — Faculty grade weight contribution to Skill Proof Score.
//
// Per research D5: faculty grades contribute UP TO 10% of the total
// Skill Proof Score. The exact contribution is the average of
// (grade / max_grade) across grades, expressed on a 0..100 scale, then
// weighted at 0.1 of the total.
//
// We expose this as a separate file (rather than mutating
// skill-proof-score.ts) so that:
//   - existing callers of computeSkillProofScore stay unchanged
//   - faculty data is opt-in: callers must explicitly pass it
//   - the computation is independently testable
//
// Typical call site (server-side, after grading flow):
//   const base = computeSkillProofScore(input);            // existing
//   const faculty = await loadFacultyGrades(userId);       // caller
//   const finalScore = applyFacultyWeight(base.score, faculty);
//
// The function is pure: no DB, no side effects.

export interface FacultyGradeInput {
  grade: number;
  max_grade: number;
}

/**
 * Blend a faculty grade component into an existing Skill Proof Score.
 *
 *  - facultyComponent (0..100) = avg(grade / max_grade) * 100
 *  - blended = currentScore * 0.9 + facultyComponent * 0.1
 *
 * Edge cases:
 *  - empty input -> returns currentScore unchanged
 *  - max_grade <= 0 for any row -> that row is skipped (guards divide-by-zero)
 *  - grade is clamped to [0, max_grade] per row before averaging
 *  - final score is rounded and clamped to [0, 100]
 */
export function applyFacultyWeight(
  currentScore: number,
  facultyGrades: FacultyGradeInput[] | null | undefined,
): number {
  if (!facultyGrades || facultyGrades.length === 0) {
    return clamp01_100(currentScore);
  }

  let sum = 0;
  let count = 0;
  for (const g of facultyGrades) {
    if (typeof g?.grade !== "number" || typeof g?.max_grade !== "number") continue;
    if (g.max_grade <= 0) continue;
    const clampedGrade = Math.max(0, Math.min(g.grade, g.max_grade));
    sum += clampedGrade / g.max_grade;
    count += 1;
  }
  if (count === 0) return clamp01_100(currentScore);

  const facultyComponent = (sum / count) * 100;
  const blended = currentScore * 0.9 + facultyComponent * 0.1;
  return Math.round(clamp01_100(blended));
}

function clamp01_100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
