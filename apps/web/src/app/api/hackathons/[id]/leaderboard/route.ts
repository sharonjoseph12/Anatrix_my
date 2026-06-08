import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Leaderboard for a single hackathon. Ranks submissions by score
// (best per student) and anonymises students who have set
// `is_public = false` on their `candidate_profiles` row. The
// contract guarantees that an anonymous row never reveals
// `student_id` (or any other identifying column).
export async function GET(_req: Request, ctx: Params) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  // 1. Best score per student for this hackathon, ranked desc.
  const { data: subs, error: sErr } = await supabase
    .from("hackathon_submissions")
    .select("student_id,score,submitted_at")
    .eq("hackathon_id", id)
    .not("score", "is", null)
    .order("score", { ascending: false });
  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  // De-dupe per student (keep best score; tie-break on earliest
  // submitted_at so repeated retries don't double-count).
  type Sub = { student_id: string; score: number | null; submitted_at: string };
  const best = new Map<string, Sub>();
  for (const s of (subs ?? []) as Sub[]) {
    if (s.score == null) continue;
    const prev = best.get(s.student_id);
    if (
      !prev ||
      (s.score ?? 0) > (prev.score ?? 0) ||
      ((s.score ?? 0) === (prev.score ?? 0) &&
        new Date(s.submitted_at).getTime() < new Date(prev.submitted_at).getTime())
    ) {
      best.set(s.student_id, s);
    }
  }
  const ranked = Array.from(best.values()).sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
  });

  if (ranked.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  // 2. Look up public visibility for these students.
  const studentIds = ranked.map((r) => r.student_id);
  const { data: profiles, error: pErr } = await supabase
    .from("candidate_profiles")
    .select("user_id,is_public,display_name,slug")
    .in("user_id", studentIds);
  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  const profileByUser = new Map<string, { is_public: boolean; display_name: string | null; slug: string | null }>();
  for (const p of (profiles ?? []) as Array<{ user_id: string; is_public: boolean; display_name: string | null; slug: string | null }>) {
    profileByUser.set(p.user_id, p);
  }

  // 3. Project to the leaderboard rows. Anonymised rows expose only
  // the rank and the score.
  const leaderboard = ranked.map((row, i) => {
    const prof = profileByUser.get(row.student_id);
    const isPublic = prof?.is_public !== false;
    return {
      rank: i + 1,
      student_id: isPublic ? row.student_id : null,
      display_name: isPublic
        ? (prof?.display_name ?? prof?.slug ?? null)
        : `Anonymous Student #${i + 1}`,
      score: row.score ?? 0,
    };
  });

  return NextResponse.json({ leaderboard });
}
