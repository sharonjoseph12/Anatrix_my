import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select(`
      user_id, slug, is_public, is_open_to_opportunities,
      overall_skill_proof_score, primary_specialization, total_commits
    `)
    .eq("slug", slug)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = profile as {
    user_id: string;
    is_public: boolean;
    is_open_to_opportunities: boolean;
    overall_skill_proof_score: number | null;
    primary_specialization: string | null;
    total_commits: number | null;
  };
  if (!p.is_public) return NextResponse.json({ error: "Private" }, { status: 403 });

  const { data: user } = await supabase
    .from("users")
    .select("id, display_name, avatar_url")
    .eq("id", p.user_id)
    .maybeSingle();
  const u = (user ?? null) as { id: string; display_name: string | null; avatar_url: string | null } | null;

  const { data: topSkills } = await supabase
    .from("user_skills")
    .select("skill_proof_score, proficiency_level, skill:skills(name)")
    .eq("user_id", p.user_id)
    .order("skill_proof_score", { ascending: false })
    .limit(5)
    .returns<Array<{
      skill_proof_score: number;
      proficiency_level: string;
      skill: { name: string } | { name: string }[] | null;
    }>>();

  const { data: credentials } = await supabase
    .from("verifiable_credentials")
    .select("id, title, issued_at")
    .eq("user_id", p.user_id)
    .eq("is_public", true)
    .order("issued_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    slug,
    user: { display_name: u?.display_name ?? null, avatar_url: u?.avatar_url ?? null },
    verified: true,
    overall_score: p.overall_skill_proof_score ?? 0,
    specialization: p.primary_specialization,
    total_commits: p.total_commits ?? 0,
    is_open_to_opportunities: p.is_open_to_opportunities,
    scheduling_url: p.is_open_to_opportunities
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/company-signup?ref=${encodeURIComponent(slug)}`
      : null,
    top_skills: ((topSkills ?? []) as Array<{
      skill_proof_score: number;
      proficiency_level: string;
      skill: { name: string } | { name: string }[] | null;
    }>).map((s) => {
      const sk = Array.isArray(s.skill) ? s.skill[0] : s.skill;
      return {
        name: sk?.name ?? "Skill",
        proficiency: s.proficiency_level,
        score: s.skill_proof_score,
      };
    }),
    credentials: (credentials ?? []).map((c) => ({
      id: (c as { id: string }).id,
      title: (c as { title: string }).title,
      issued_at: (c as { issued_at: string | null }).issued_at,
    })),
  });
}
