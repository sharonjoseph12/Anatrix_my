import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const QuerySchema = z.object({
  skills: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
  min_score: z.number().int().min(0).max(100).optional().default(60),
  batch_years: z.array(z.number().int().min(2000).max(2100)).max(20).optional().default([]),
  locations: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  specialization: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(100).optional().default(25),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 30 searches per minute per user
  const limit = rateLimit({ key: `recruiter-search:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!limit.ok) return rateLimitResponse(limit.resetAt);

  // Caller must be a recruiter/admin of some company
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .in("role", ["recruiter", "admin", "hiring_manager"])
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const companyId = (membership as { company_id: string }).company_id;

  const json = await req.json().catch(() => ({}));
  const parsed = QuerySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const q = parsed.data;

  // 1. Base filter on candidate_profiles
  let query = supabase
    .from("candidate_profiles")
    .select(`
      id, user_id, overall_skill_proof_score, primary_specialization, specialization_scores,
      total_hours_logged, total_projects_completed, total_sessions, total_commits,
      avg_focus_quality, placement_ready, is_public, is_open_to_opportunities,
      preferred_locations, last_updated_at
    `)
    .eq("is_public", true)
    .gte("overall_skill_proof_score", q.min_score)
    .order("overall_skill_proof_score", { ascending: false })
    .limit(q.limit);

  if (q.specialization) {
    query = query.ilike("primary_specialization", `%${q.specialization}%`);
  }

  const { data: candidates, error: cErr } = await query;
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  // 2. Optional skill filter via user_skills join
  let userIds = (candidates ?? []).map((c) => c.user_id);
  if (q.skills.length > 0 && userIds.length > 0) {
    const { data: usRows, error: usErr } = await supabase
      .from("user_skills")
      .select("user_id,skills:skills(slug,name)")
      .in("user_id", userIds);
    if (usErr) return NextResponse.json({ error: usErr.message }, { status: 500 });

    const userToSlugs = new Map<string, Set<string>>();
    for (const r of usRows ?? []) {
      const slug = (r as unknown as { skills: { slug: string; name: string } | null }).skills?.slug;
      if (!slug) continue;
      const set = userToSlugs.get(r.user_id) ?? new Set<string>();
      set.add(slug);
      userToSlugs.set(r.user_id, set);
    }
    userIds = userIds.filter((id) => {
      const set = userToSlugs.get(id);
      if (!set) return false;
      return q.skills.every((s) => set.has(s));
    });
  }

  // 3. Optional batch year filter (derived from institution_members)
  if (q.batch_years.length > 0 && userIds.length > 0) {
    const { data: members, error: mErr } = await supabase
      .from("institution_members")
      .select("user_id,batch_year")
      .in("user_id", userIds)
      .in("batch_year", q.batch_years);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    const matched = new Set((members ?? []).map((m) => m.user_id));
    userIds = userIds.filter((id) => matched.has(id));
  }

  // 4. Optional location filter
  if (q.locations.length > 0 && userIds.length > 0) {
    const filtered: string[] = [];
    for (const c of candidates ?? []) {
      if (!userIds.includes(c.user_id)) continue;
      const locs = (c.preferred_locations as string[] | null) ?? [];
      if (q.locations.some((l) => locs.includes(l))) filtered.push(c.user_id);
    }
    userIds = filtered;
  }

  // 5. Hydrate user data + compute match_score
  const filtered = (candidates ?? []).filter((c) => userIds.includes(c.user_id));

  const { data: users } = await supabase
    .from("users")
    .select("id,email,display_name,avatar_url")
    .in("id", userIds);
  const userMap = new Map<string, NonNullable<typeof users>[number]>();
  for (const u of users ?? []) userMap.set(u.id, u);

  // 6. Persist this search for analytics
  await supabase.from("recruiter_searches").insert({
    company_id: companyId,
    recruiter_id: user.id,
    search_name: q.specialization ?? "Custom search",
    skill_filters: q.skills,
    min_skill_proof_score: q.min_score,
    batch_years: q.batch_years,
    locations: q.locations,
    results_count: filtered.length,
  });

  const enriched = filtered.map((c) => {
    const u = userMap.get(c.user_id);
    const score = c.overall_skill_proof_score ?? 0;
    return {
      candidate_id: c.id,
      user_id: c.user_id,
      display_name: u?.display_name ?? null,
      email: u?.email ?? null,
      avatar_url: u?.avatar_url ?? null,
      match_score: score,
      primary_specialization: c.primary_specialization,
      total_hours_logged: c.total_hours_logged,
      total_projects_completed: c.total_projects_completed,
      total_sessions: c.total_sessions,
      total_commits: c.total_commits,
      avg_focus_quality: c.avg_focus_quality,
      placement_ready: c.placement_ready,
      is_open_to_opportunities: c.is_open_to_opportunities,
    };
  });

  return NextResponse.json({ count: enriched.length, candidates: enriched });
}
