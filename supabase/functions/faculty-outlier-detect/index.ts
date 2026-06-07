// supabase/functions/faculty-outlier-detect/index.ts
// 11/10 — Faculty grading outlier monitor (research D5).
//
// Runs nightly (cron `faculty-outlier-detect-nightly`, see
// 038_cron_004.sql) and flags faculty whose mean grade distribution
// deviates from their institution's peer mean by more than 2 standard
// deviations, AND who have issued at least 5 grades in the trailing
// 90-day window.
//
// Per D5: outlier monitoring is INFORMATIONAL. This function does NOT
// auto-disqualify anyone, modify any faculty_verifications or
// faculty_grades rows, or send any notifications. It only writes
// structured warn-level log lines (one per flagged faculty) so the
// college-admin console / on-call channel can pick them up via the
// existing observability stack (supabase.functions.invoke_log).
//
// The cron payload is `{}` (no args). The function ALSO accepts the
// literal `{ "sweep": true }` for symmetry with the other 004 sweeps.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";

// ----- env ------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OUTLIER_STDEV_THRESHOLD = Number(
  Deno.env.get("FACULTY_OUTLIER_STDEV_THRESHOLD") ?? "2",
);
const MIN_GRADES_WINDOW = Number(
  Deno.env.get("FACULTY_OUTLIER_MIN_GRADES_WINDOW") ?? "5",
);
const WINDOW_DAYS = Number(
  Deno.env.get("FACULTY_OUTLIER_WINDOW_DAYS") ?? "90",
);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----- per-faculty distribution query --------------------------------------

interface FacultyStat {
  faculty_id: string;
  institution_id: string;
  grade_count: number;
  mean_grade: number | null;
  stdev_grade: number | null;
}

async function loadFacultyStats(): Promise<FacultyStat[]> {
  // One row per active faculty: count, mean, stdev of grades issued
  // in the last 90 days. faculty with zero grades in the window are
  // included with count=0, mean=NULL, stdev=NULL; they will be
  // skipped by the MIN_GRADES_WINDOW gate downstream.
  const { data, error } = await supabase.rpc("faculty_outlier_stats", {
    p_window_days: WINDOW_DAYS,
  });
  if (error || !data) {
    // Fallback: do the aggregation client-side via a couple of
    // selects. The RPC may not exist in environments that haven't
    // applied a future migration; the fallback keeps the sweep
    // runnable end-to-end without that migration.
    return await loadFacultyStatsFallback();
  }
  return (data as FacultyStat[]).map((r) => ({
    faculty_id: r.faculty_id,
    institution_id: r.institution_id,
    grade_count: Number(r.grade_count) || 0,
    mean_grade: r.mean_grade === null ? null : Number(r.mean_grade),
    stdev_grade: r.stdev_grade === null ? null : Number(r.stdev_grade),
  }));
}

async function loadFacultyStatsFallback(): Promise<FacultyStat[]> {
  // 1) active faculty (verified, not revoked)
  const { data: fvRows, error: fvErr } = await supabase
    .from("faculty_verifications")
    .select("user_id, institution_id")
    .eq("verified", true)
    .is("revoked_at", null);
  if (fvErr) throw new Error(`faculty_verifications read: ${fvErr.message}`);
  const faculty = (fvRows ?? []) as Array<{ user_id: string; institution_id: string }>;
  if (faculty.length === 0) return [];

  // 2) grades in the window
  const cutoffIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data: gRows, error: gErr } = await supabase
    .from("faculty_grades")
    .select("faculty_id, grade, graded_at")
    .gte("graded_at", cutoffIso);
  if (gErr) throw new Error(`faculty_grades read: ${gErr.message}`);
  const grades = (gRows ?? []) as Array<{ faculty_id: string; grade: number; graded_at: string }>;

  // 3) aggregate
  const byFaculty = new Map<string, number[]>();
  for (const g of grades) {
    const list = byFaculty.get(g.faculty_id) ?? [];
    list.push(g.grade);
    byFaculty.set(g.faculty_id, list);
  }

  return faculty.map((f) => {
    const list = byFaculty.get(f.user_id) ?? [];
    const count = list.length;
    if (count === 0) {
      return {
        faculty_id: f.user_id,
        institution_id: f.institution_id,
        grade_count: 0,
        mean_grade: null,
        stdev_grade: null,
      };
    }
    const mean = list.reduce((s, x) => s + x, 0) / count;
    const variance = list.reduce((s, x) => s + (x - mean) ** 2, 0) / count;
    const stdev = Math.sqrt(variance);
    return {
      faculty_id: f.user_id,
      institution_id: f.institution_id,
      grade_count: count,
      mean_grade: mean,
      stdev_grade: stdev,
    };
  });
}

// ----- per-institution peer statistics + flag -----------------------------

interface PeerStats {
  mean: number;
  stdev: number;
  sample: number;
}

function peerStatsOf(values: number[]): PeerStats {
  if (values.length === 0) return { mean: 0, stdev: 0, sample: 0 };
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  if (values.length < 2) return { mean, stdev: 0, sample: values.length };
  const variance =
    values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
  return { mean, stdev: Math.sqrt(variance), sample: values.length };
}

interface OutlierFlag {
  institution_id: string;
  faculty_id: string;
  mean: number;
  peer_mean: number;
  peer_stdev: number;
  deviation_stdevs: number;
  graded_count: number;
}

function flagOutliers(stats: FacultyStat[]): OutlierFlag[] {
  // Group by institution; skip faculty with no grades in window when
  // computing peer stats (they have no signal, so they can't be
  // outliers and shouldn't bias the peer mean).
  const byInst = new Map<string, FacultyStat[]>();
  for (const s of stats) {
    if (s.mean_grade === null) continue;
    const list = byInst.get(s.institution_id) ?? [];
    list.push(s);
    byInst.set(s.institution_id, list);
  }

  const flags: OutlierFlag[] = [];
  for (const [institutionId, group] of byInst) {
    const peerMeans = group.map((g) => g.mean_grade as number);
    const peer = peerStatsOf(peerMeans);
    // Need at least 3 faculty in the institution with grades to make
    // the peer distribution meaningful. With fewer, the peer stdev is
    // too unstable to flag a single outlier.
    if (peer.sample < 3 || peer.stdev === 0) continue;
    for (const f of group) {
      if (f.grade_count < MIN_GRADES_WINDOW) continue;
      const m = f.mean_grade as number;
      const deviationStdevs = Math.abs(m - peer.mean) / peer.stdev;
      if (deviationStdevs > OUTLIER_STDEV_THRESHOLD) {
        flags.push({
          institution_id: institutionId,
          faculty_id: f.faculty_id,
          mean: round2(m),
          peer_mean: round2(peer.mean),
          peer_stdev: round2(peer.stdev),
          deviation_stdevs: round2(deviationStdevs),
          graded_count: f.grade_count,
        });
      }
    }
  }
  return flags;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ----- sweep ----------------------------------------------------------------

interface SweepResult {
  ok: true;
  institutions_scanned: number;
  faculty_checked: number;
  outliers_flagged: number;
}

async function sweep(): Promise<SweepResult> {
  const stats = await loadFacultyStats();
  const institutions = new Set(stats.map((s) => s.institution_id));
  const facultyWithGrades = stats.filter((s) => s.grade_count > 0).length;
  const flags = flagOutliers(stats);

  for (const f of flags) {
    // One structured warn line per outlier. The observability stack
    // (supabase.functions.invoke_log) picks this up automatically; an
    // on-call alert can be wired in v1.1.
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "faculty_outlier",
        institution_id: f.institution_id,
        faculty_id: f.faculty_id,
        mean: f.mean,
        peer_mean: f.peer_mean,
        peer_stdev: f.peer_stdev,
        deviation_stdevs: f.deviation_stdevs,
        graded_count: f.graded_count,
      }),
    );
  }

  return {
    ok: true,
    institutions_scanned: institutions.size,
    faculty_checked: facultyWithGrades,
    outliers_flagged: flags.length,
  };
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

  // The cron (038_cron_004.sql) fires with `{}`; the function treats
  // both `{}` and `{sweep:true}` as "run the sweep". We deliberately
  // do NOT make any external calls — the only I/O is into Supabase
  // Postgres (service role, RLS bypass).
  try {
    const body = (await req.json().catch(() => ({}))) as { sweep?: boolean };
    if (body.sweep !== false) {
      const r = await sweep();
      return json(r);
    }
    return json({ error: "Only sweep mode is supported" }, 400);
  } catch (e) {
    console.error("faculty-outlier-detect failed", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
