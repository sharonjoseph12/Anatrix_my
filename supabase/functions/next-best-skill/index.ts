// supabase/functions/next-best-skill/index.ts
//
// MIRRORS apps/web/src/lib/algorithms/next-best-skill.ts — keep in sync.
// Edge Functions cannot import from apps/web, so the algorithm is
// duplicated inline. If you edit one, edit the other. The Deno file is
// the source of truth for the production cron; the TS module is the
// source of truth for the in-process Vitest unit tests.
//
// 11/10 — Next-Best-Skill recommender (research D10, US3 /
// FR-NBS-001..005). Computes the top-N next-skill suggestions for
// every active student and persists them to public.next_best_skills
// (defined in 037_api_outcome_nbs.sql). The student-facing card in
// /dashboard/skills reads from that table.
//
// Two modes:
//   - SWEEP (cron):  POST { sweep: true }   (or {} from 038_cron_004)
//                    Recomputes for every student with ≥ 3 verified
//                    skills in user_skills.
//   - SINGLE:        POST { user_id: "<uuid>" }
//                    Recomputes for one student (e.g. on profile
//                    update).
//
// v1 data mapping (no historical skill-snapshot table exists in
// 001-033 — a future migration could add a per-user skill history to
// remove this approximation):
//   - alumni corpus:       students with at least one row in
//                          public.outcome_billing_events (i.e. a
//                          confirmed placement per the outcome-pricing
//                          pipeline).
//   - alumni skills:       current user_skills rows for that student
//                          (used for BOTH pre and post — v1 approx).
//   - placement_company:   companies.name from the offer that produced
//                          the billing event (student_applications +
//                          companies).
//   - student current:     user_skills for the target student.
//
// The recommender is mirrored from
// apps/web/src/lib/algorithms/next-best-skill.ts; see the
// `recommendForStudent` function below.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

// ----- env ------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MIN_SOURCE_COUNT = Number(Deno.env.get("NEXT_BEST_SKILL_MIN_SOURCE_COUNT") ?? "5");
const JACCARD_THRESHOLD = Number(Deno.env.get("NEXT_BEST_SKILL_JACCARD_THRESHOLD") ?? "0.6");
const TOP_K = Number(Deno.env.get("NEXT_BEST_SKILL_TOP_K") ?? "3");
const SWEEP_STUDENT_LIMIT = 500;
const SWEEP_BATCH_SIZE = 25;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----- types ----------------------------------------------------------------

interface AlumniProfile {
  id: string;
  pre_placement_skills: string[];
  post_placement_skills: string[];
  placement_company: string;
}

interface StudentProfile {
  id: string;
  current_skills: string[];
}

interface Recommendation {
  skill: string;
  rank: number;
  source_count: number;
  confidence: number;
  reasoning: string;
}

// ----- mirrored recommender (keep in sync) ---------------------------------

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

function computeRecommendations(
  student: StudentProfile,
  alumni: ReadonlyArray<AlumniProfile>,
  options: { minSourceCount: number; jaccardThreshold: number; topK: number },
): Recommendation[] {
  const { minSourceCount, jaccardThreshold, topK } = options;
  if (student.current_skills.length === 0) return [];

  const kept = alumni.filter((a) => jaccard(student.current_skills, a.pre_placement_skills) >= jaccardThreshold);
  if (kept.length === 0) return [];

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
  const candidates: Array<{
    skill: string;
    count: number;
    confidence: number;
    reasoning: string;
    tieCompany: string;
  }> = [];
  for (const [skill, entry] of aggregated) {
    if (entry.count < minSourceCount) continue;
    const confidence = round2(Math.min(0.95, entry.count / keptCount));
    const company = mode(entry.companies);
    const reasoning =
      `${entry.count} of ${keptCount} alumni placed at ${company} added ${skill} after your current stack`;
    candidates.push({ skill, count: entry.count, confidence, reasoning, tieCompany: company });
  }

  candidates.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.tieCompany !== b.tieCompany) return a.tieCompany < b.tieCompany ? -1 : 1;
    if (a.skill !== b.skill) return a.skill < b.skill ? -1 : 1;
    return 0;
  });

  return candidates.slice(0, topK).map((c, i) => ({
    skill: c.skill,
    rank: i + 1,
    source_count: c.count,
    confidence: c.confidence,
    reasoning: c.reasoning,
  }));
}

// ----- data access helpers --------------------------------------------------

async function loadStudentSkillNames(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_skills")
    .select("skill:skills(name)")
    .eq("user_id", studentId);
  if (error) throw new Error(`loadStudentSkillNames(${studentId}): ${error.message}`);
  const rows = (data ?? []) as Array<{ skill: { name: string } | { name: string }[] | null }>;
  const names: string[] = [];
  for (const r of rows) {
    const s = r.skill;
    if (Array.isArray(s)) {
      for (const one of s) if (one?.name) names.push(one.name);
    } else if (s && typeof s === "object" && "name" in s && s.name) {
      names.push(s.name);
    }
  }
  return names;
}

async function loadAlumniCorpus(): Promise<AlumniProfile[]> {
  // Alumni = distinct students with at least one row in
  // outcome_billing_events. v1 approximation: use the user's CURRENT
  // user_skills for both pre and post, and use the company name from
  // the offer that produced the billing event.
  const { data, error } = await supabase
    .from("outcome_billing_events")
    .select(`
      student_id,
      offer:student_applications(
        id,
        company:companies(name)
      )
    `)
    .limit(10_000);
  if (error) throw new Error(`loadAlumniCorpus: ${error.message}`);

  type Row = { student_id: string; offer: { id: string; company: { name: string } | { name: string }[] | null } | { id: string; company: { name: string } | { name: string }[] | null }[] | null };
  const rows = (data ?? []) as Row[];

  const companyByStudent = new Map<string, string>();
  for (const r of rows) {
    if (companyByStudent.has(r.student_id)) continue;
    const offer = Array.isArray(r.offer) ? r.offer[0] : r.offer;
    const company = offer ? (Array.isArray(offer.company) ? offer.company[0] : offer.company) : null;
    if (company && typeof company === "object" && "name" in company && company.name) {
      companyByStudent.set(r.student_id, company.name);
    }
  }

  if (companyByStudent.size === 0) return [];

  const alumniIds = Array.from(companyByStudent.keys());
  const { data: skillsData, error: skillsErr } = await supabase
    .from("user_skills")
    .select("user_id, skill:skills(name)")
    .in("user_id", alumniIds);
  if (skillsErr) throw new Error(`loadAlumniCorpus skills: ${skillsErr.message}`);

  const skillsByStudent = new Map<string, string[]>();
  const sRows = (skillsData ?? []) as Array<{ user_id: string; skill: { name: string } | { name: string }[] | null }>;
  for (const r of sRows) {
    const list = skillsByStudent.get(r.user_id) ?? [];
    const s = r.skill;
    if (Array.isArray(s)) {
      for (const one of s) if (one?.name) list.push(one.name);
    } else if (s && typeof s === "object" && "name" in s && s.name) {
      list.push(s.name);
    }
    skillsByStudent.set(r.user_id, list);
  }

  const corpus: AlumniProfile[] = [];
  for (const [studentId, company] of companyByStudent) {
    const skills = skillsByStudent.get(studentId) ?? [];
    corpus.push({
      id: studentId,
      pre_placement_skills: skills,
      post_placement_skills: skills,
      placement_company: company,
    });
  }
  return corpus;
}

async function replaceRecommendationsFor(studentId: string, recs: Recommendation[]): Promise<void> {
  // Idempotent: DELETE old rows for this student, then INSERT the
  // freshly computed ones. The unique (student_id, skill) index
  // (defined in 037) means the INSERT would be UPSERT-compatible,
  // but DELETE+INSERT is cheaper to reason about and the volume is
  // tiny (≤ 3 rows per student).
  const { error: delErr } = await supabase
    .from("next_best_skills")
    .delete()
    .eq("student_id", studentId);
  if (delErr) throw new Error(`next_best_skills delete: ${delErr.message}`);

  if (recs.length === 0) return;

  const now = new Date().toISOString();
  const rows = recs.map((r) => ({
    student_id: studentId,
    skill: r.skill,
    rank: r.rank,
    source_count: r.source_count,
    confidence: r.confidence,
    reasoning: r.reasoning,
    computed_at: now,
  }));
  const { error: insErr } = await supabase.from("next_best_skills").insert(rows);
  if (insErr) throw new Error(`next_best_skills insert: ${insErr.message}`);
}

async function recommendAndStore(studentId: string, corpus: AlumniProfile[]): Promise<number> {
  const currentSkills = await loadStudentSkillNames(studentId);
  const recs = computeRecommendations(
    { id: studentId, current_skills: currentSkills },
    corpus,
    { minSourceCount: MIN_SOURCE_COUNT, jaccardThreshold: JACCARD_THRESHOLD, topK: TOP_K },
  );
  await replaceRecommendationsFor(studentId, recs);
  return recs.length;
}

// ----- modes ----------------------------------------------------------------

async function singleStudent(studentId: string): Promise<{ ok: true; student_id: string; recommendations: number }> {
  if (!isUuid(studentId)) {
    return { ok: true, student_id: studentId, recommendations: 0 };
  }
  const corpus = await loadAlumniCorpus();
  const recommendations = await recommendAndStore(studentId, corpus);
  return { ok: true, student_id: studentId, recommendations };
}

async function sweep(): Promise<{
  ok: true;
  students_processed: number;
  students_skipped: number;
  recommendations_per_student: number;
  total_recommendations: number;
}> {
  // Eligible students: those with ≥ 3 user_skills rows. v1 proxy for
  // "verified skills in the last 90 days"; a future migration may add
  // an explicit last_verified_at column to user_skills to tighten this.
  const { data: rows, error } = await supabase
    .from("user_skills")
    .select("user_id")
    .limit(SWEEP_STUDENT_LIMIT * 5);
  if (error) throw new Error(`sweep user_skills read: ${error.message}`);

  const counts = new Map<string, number>();
  for (const r of (rows ?? []) as Array<{ user_id: string }>) {
    counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  }
  const eligible = Array.from(counts.entries())
    .filter(([, c]) => c >= 3)
    .map(([id]) => id)
    .slice(0, SWEEP_STUDENT_LIMIT);

  if (eligible.length === 0) {
    return {
      ok: true,
      students_processed: 0,
      students_skipped: 0,
      recommendations_per_student: 0,
      total_recommendations: 0,
    };
  }

  const corpus = await loadAlumniCorpus();

  let processed = 0;
  let totalRecommendations = 0;
  let recommendationsPerStudent = 0;
  let studentsWithRecs = 0;

  for (let i = 0; i < eligible.length; i += SWEEP_BATCH_SIZE) {
    const batch = eligible.slice(i, i + SWEEP_BATCH_SIZE);
    for (const studentId of batch) {
      try {
        const n = await recommendAndStore(studentId, corpus);
        processed += 1;
        totalRecommendations += n;
        if (n > 0) {
          studentsWithRecs += 1;
          recommendationsPerStudent += n;
        }
      } catch (e) {
        console.error("next-best-skill per-student failed", {
          student_id: studentId,
          error: (e as Error).message,
        });
      }
    }
  }

  return {
    ok: true,
    students_processed: processed,
    students_skipped: eligible.length - processed,
    recommendations_per_student: studentsWithRecs > 0 ? Math.round(recommendationsPerStudent / studentsWithRecs) : 0,
    total_recommendations: totalRecommendations,
  };
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ----- handler --------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Server misconfiguration" }, 500);
  }
  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    sweep?: boolean;
  };

  try {
    if (body.sweep || (!body.user_id && !body.sweep)) {
      const r = await sweep();
      return json(r);
    }
    if (!body.user_id) {
      return json({ error: "user_id is required (or pass {sweep:true})" }, 400);
    }
    const r = await singleStudent(body.user_id);
    return json(r);
  } catch (e) {
    console.error("next-best-skill handler failed", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
