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

type QueryInput = z.infer<typeof QuerySchema>;

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit({ key: `recruiter-search:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!limit.ok) return rateLimitResponse(limit.resetAt);

  const companyId = await getCompanyId(supabase, user.id);
  if (!companyId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = QuerySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const q = parsed.data;

  const candidates = await fetchBaseCandidates(supabase, q);
  if (!candidates) return NextResponse.json({ error: "Fetch error" }, { status: 500 });

  let userIds = candidates.map((c: any) => c.user_id);
  userIds = await filterBySkills(supabase, userIds, q.skills);
  userIds = await filterByBatch(supabase, userIds, q.batch_years);
  userIds = filterByLocation(candidates, userIds, q.locations);

  const filtered = candidates.filter((c: any) => userIds.includes(c.user_id));
  const enriched = await hydrateCandidates(supabase, filtered);

  await persistSearch(supabase, companyId, user.id, q, filtered.length);

  return NextResponse.json({ count: enriched.length, candidates: enriched });
}

async function getCompanyId(supabase: any, userId: string) {
  const { data } = await supabase.from("company_members")
    .select("company_id").eq("user_id", userId).in("role", ["recruiter", "admin", "hiring_manager"])
    .limit(1).maybeSingle();
  return data?.company_id;
}

async function fetchBaseCandidates(supabase: any, q: QueryInput) {
  let query = supabase.from("candidate_profiles")
    .select(`id, user_id, overall_skill_proof_score, primary_specialization, specialization_scores, total_hours_logged, total_projects_completed, total_sessions, total_commits, avg_focus_quality, placement_ready, is_public, is_open_to_opportunities, preferred_locations, last_updated_at`)
    .eq("is_public", true)
    .gte("overall_skill_proof_score", q.min_score)
    .order("overall_skill_proof_score", { ascending: false })
    .limit(q.limit);
  if (q.specialization) query = query.ilike("primary_specialization", `%${q.specialization}%`);
  const { data } = await query;
  return data;
}

async function filterBySkills(supabase: any, userIds: string[], skills: string[]) {
  if (!skills.length || !userIds.length) return userIds;
  const { data } = await supabase.from("user_skills").select("user_id,skills:skills(slug)").in("user_id", userIds);
  const userToSlugs = buildUserSkillsMap(data ?? []);
  return userIds.filter((id) => skills.every((s) => userToSlugs.get(id)?.has(s)));
}

function buildUserSkillsMap(data: any[]) {
  const userToSlugs = new Map<string, Set<string>>();
  for (const r of data) {
    const slug = (r as any).skills?.slug;
    if (!slug) continue;
    const set = userToSlugs.get(r.user_id) ?? new Set();
    set.add(slug);
    userToSlugs.set(r.user_id, set);
  }
  return userToSlugs;
}

async function filterByBatch(supabase: any, userIds: string[], batches: number[]) {
  if (!batches.length || !userIds.length) return userIds;
  const { data } = await supabase.from("institution_members").select("user_id").in("user_id", userIds).in("batch_year", batches);
  const matched = new Set((data ?? []).map((m: any) => m.user_id));
  return userIds.filter((id) => matched.has(id));
}

function filterByLocation(candidates: any[], userIds: string[], locations: string[]) {
  if (!locations.length || !userIds.length) return userIds;
  return userIds.filter((id) => {
    const c = candidates.find((x) => x.user_id === id);
    const locs = (c?.preferred_locations as string[]) ?? [];
    return locations.some((l) => locs.includes(l));
  });
}

async function hydrateCandidates(supabase: any, candidates: any[]) {
  if (!candidates.length) return [];
  const { data: users } = await supabase.from("users").select("id,email,display_name,avatar_url").in("id", candidates.map((c: any) => c.user_id));
  const userMap = new Map<string, any>((users ?? []).map((u: any) => [u.id, u]));
  return candidates.map((c) => mapCandidate(c, userMap));
}

function mapCandidate(c: any, userMap: Map<string, any>) {
  const u = userMap.get(c.user_id);
  return {
    candidate_id: c.id, user_id: c.user_id, display_name: u?.display_name ?? null, email: u?.email ?? null,
    avatar_url: u?.avatar_url ?? null, match_score: c.overall_skill_proof_score ?? 0,
    primary_specialization: c.primary_specialization, total_hours_logged: c.total_hours_logged,
    total_projects_completed: c.total_projects_completed, total_sessions: c.total_sessions,
    total_commits: c.total_commits, avg_focus_quality: c.avg_focus_quality,
    placement_ready: c.placement_ready, is_open_to_opportunities: c.is_open_to_opportunities,
  };
}

async function persistSearch(supabase: any, companyId: string, userId: string, q: QueryInput, count: number) {
  await supabase.from("recruiter_searches").insert({
    company_id: companyId, recruiter_id: userId, search_name: q.specialization ?? "Custom search",
    skill_filters: q.skills, min_skill_proof_score: q.min_score, batch_years: q.batch_years,
    locations: q.locations, results_count: count,
  });
}
