import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, Sparkles, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { profileTier } from "@/lib/algorithms/profile-score";
import { ProfileHeader } from "@/components/public-profile/profile-header";
import { SkillList, type PublicSkill } from "@/components/public-profile/skill-list";
import { GitHubHeatmap } from "@/components/public-profile/github-heatmap";
import { CredentialsList, type PublicCredential } from "@/components/public-profile/credentials-list";
import type { HeatmapDay } from "@/components/charts/activity-heatmap";

// ISR with 5-min revalidation per FR-004
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

// Warm the top 100 most-recently-active public slugs at build/refresh.
export async function generateStaticParams() {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("candidate_profiles")
      .select("slug")
      .eq("is_public", true)
      .order("last_score_change_at", { ascending: false, nullsFirst: false })
      .limit(100)
      .returns<Array<{ slug: string | null }>>();
    return (data ?? [])
      .map((r) => r.slug)
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

// Pages not in the warm set are generated on-demand then cached for 5min.
export const dynamicParams = true;

async function loadProfile(slug: string) {
  const supabase = await createSupabaseServerClient();

  // Check slug history first (90-day redirect)
  const { data: redirect } = await supabase
    .from("slug_redirects")
    .select("new_slug,user_id,expires_at")
    .eq("old_slug", slug)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (redirect) {
    const r = redirect as { new_slug: string; user_id: string };
    return { kind: "redirect" as const, new_slug: r.new_slug };
  }

  const { data: profile, error } = await supabase
    .from("candidate_profiles")
    .select(`
      user_id, slug, is_public, is_open_to_opportunities,
      overall_skill_proof_score, primary_specialization, total_commits,
      last_score_change_at
    `)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !profile) return { kind: "not_found" as const };
  const p = profile as {
    user_id: string;
    slug: string;
    is_public: boolean;
    is_open_to_opportunities: boolean;
    overall_skill_proof_score: number | null;
    primary_specialization: string | null;
    total_commits: number | null;
    last_score_change_at: string | null;
  };
  if (!p.is_public) return { kind: "private" as const };

  // Hydrate user
  const { data: user } = await supabase
    .from("users")
    .select("id, display_name, avatar_url, last_active_at")
    .eq("id", p.user_id)
    .maybeSingle();
  if (!user) return { kind: "not_found" as const };
  const u = user as { id: string; display_name: string | null; avatar_url: string | null };

  // Top skills (5)
  const { data: topSkills } = await supabase
    .from("user_skills")
    .select("skill_proof_score, proficiency_level, skill:skills(name, category)")
    .eq("user_id", p.user_id)
    .order("skill_proof_score", { ascending: false })
    .limit(5)
    .returns<Array<{
      skill_proof_score: number;
      proficiency_level: string;
      skill: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
    }>>();

  // Issued credentials
  const { data: credentials } = await supabase
    .from("verifiable_credentials")
    .select("id, title, issued_at, slug")
    .eq("user_id", p.user_id)
    .eq("is_public", true)
    .order("issued_at", { ascending: false })
    .limit(10);

  // Recent commits (for heat map)
  const { data: commits } = await supabase
    .from("github_commits")
    .select("committed_at")
    .eq("user_id", p.user_id)
    .gte("committed_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
    .order("committed_at", { ascending: false });

  const heatmap = aggregateHeatmap(commits ?? []);

  return {
    kind: "ok" as const,
    profile: p,
    user: u,
    topSkills: ((topSkills ?? []) as Array<{
      skill_proof_score: number;
      proficiency_level: string;
      skill: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
    }>).map((s): PublicSkill => {
      const sk = Array.isArray(s.skill) ? s.skill[0] : s.skill;
      return {
        name: sk?.name ?? "Skill",
        proficiency: s.proficiency_level,
        score: s.skill_proof_score,
        category: sk?.category ?? null,
      };
    }),
    credentials: ((credentials ?? []) as Array<{
      id: string;
      title: string;
      issued_at: string | null;
      slug: string | null;
    }>).map((c): PublicCredential => ({
      id: c.id,
      title: c.title,
      issued_at: c.issued_at,
      slug: c.slug,
    })),
    heatmap,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadProfile(slug);
  if (data.kind === "ok") {
    const title = `${data.user.display_name ?? "Antarix profile"} · ${data.profile.overall_skill_proof_score ?? 0}/100`;
    const description = data.profile.primary_specialization
      ? `${data.profile.primary_specialization} · verified Skill Proof Score ${data.profile.overall_skill_proof_score ?? 0}/100`
      : `Verified Skill Proof Score ${data.profile.overall_skill_proof_score ?? 0}/100`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "profile",
        images: [`/u/${slug}/opengraph-image`],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`/u/${slug}/opengraph-image`],
      },
      robots: { index: true, follow: true },
    };
  }
  return {
    title: "Profile not found",
    robots: { index: false, follow: false },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { slug } = await params;
  const data = await loadProfile(slug);

  if (data.kind === "redirect") {
    return (
      <main className="container mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Handle changed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          @{slug} is now @{data.new_slug}.{" "}
          <Link className="text-primary underline" href={`/${data.new_slug}`}>
            View the new profile →
          </Link>
        </p>
      </main>
    );
  }
  if (data.kind === "not_found") notFound();
  if (data.kind === "private") {
    return (
      <main className="container mx-auto max-w-md px-4 py-16 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">This profile is private</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The owner of @{slug} has not published a public profile yet.
        </p>
      </main>
    );
  }

  const { user, profile, topSkills, credentials, heatmap } = data;
  const tier = profileTier(profile.overall_skill_proof_score ?? 0);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <ProfileHeader
              displayName={user.display_name ?? "Anonymous"}
              avatarUrl={user.avatar_url}
              overallScore={profile.overall_skill_proof_score ?? 0}
              specialization={profile.primary_specialization}
              tier={tier}
              verified
            />
          </CardHeader>
          {profile.is_open_to_opportunities && (
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">Open to opportunities</span>
                <span className="text-muted-foreground">·</span>
                <Button asChild size="sm">
                  <Link href={`/company-signup?ref=${encodeURIComponent(slug)}`}>
                    <Calendar className="h-3 w-3" />
                    Schedule an interview
                  </Link>
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="mt-6 grid grid-cols-1 gap-4">
          <SkillList skills={topSkills} />
          <GitHubHeatmap data={heatmap} totalCommits={profile.total_commits ?? 0} />
          <CredentialsList credentials={credentials} />
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            antarix.app/{slug}
          </Badge>
        </div>
      </div>
    </main>
  );
}

function aggregateHeatmap(commits: Array<{ committed_at: string }>): HeatmapDay[] {
  const counts = new Map<string, number>();
  for (const c of commits) {
    const day = c.committed_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}
