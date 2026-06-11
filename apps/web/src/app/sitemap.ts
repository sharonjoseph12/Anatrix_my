// apps/web/src/app/sitemap.ts
// T054 — Sitemap with public profiles baked in. Top 500 most-recently-active
// public profiles are included; ISR revalidates hourly via the top-level
// `revalidate` export below.

import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Refresh hourly — sitemap only needs to track *new* public profiles, not
// incremental score changes (those are picked up by ISR at /u/[slug]).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("candidate_profiles")
    .select("slug,last_score_change_at")
    .eq("is_public", true)
    .not("slug", "is", null)
    .order("last_score_change_at", { ascending: false, nullsFirst: false })
    .limit(500)
    .returns<Array<{ slug: string | null; last_score_change_at: string | null }>>();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/login`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const profileRoutes: MetadataRoute.Sitemap = (data ?? [])
    .filter((r): r is { slug: string; last_score_change_at: string | null } => typeof r.slug === "string")
    .map((r) => ({
      url: `${APP_URL}/${r.slug}`,
      lastModified: r.last_score_change_at ? new Date(r.last_score_change_at) : new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    }));

  return [...staticRoutes, ...profileRoutes];
}
