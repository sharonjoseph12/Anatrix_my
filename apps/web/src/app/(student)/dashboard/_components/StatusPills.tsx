// apps/web/src/app/(student)/dashboard/_components/StatusPills.tsx
// T051 — Surface small "DSA connected" + "Public profile live" pills on the
// student dashboard. Renders nothing if both are false (don't clutter the UI).
// Pulls the data server-side and renders a thin row of chips + quick links.

import Link from "next/link";
import { CheckCircle2, Code2, ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function StatusPills() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Run the two small lookups in parallel.
  const [dsaRes, profileRes] = await Promise.all([
    supabase
      .from("user_dsa_profiles")
      .select("platform,sync_status")
      .eq("user_id", user.id)
      .eq("sync_status", "active")
      .returns<Array<{ platform: "leetcode" | "hackerrank"; sync_status: string }>>(),
    supabase
      .from("candidate_profiles")
      .select("slug,is_public")
      .eq("user_id", user.id)
      .maybeSingle<{ slug: string | null; is_public: boolean }>(),
  ]);

  const platforms = (dsaRes.data ?? []).map((r) => r.platform);
  const slug = profileRes.data?.slug ?? null;
  const isPublic = !!profileRes.data?.is_public;

  const dsaOk = platforms.length > 0;
  const pubOk = !!slug && isPublic;
  if (!dsaOk && !pubOk) return null;

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dsaOk && (
        <Link
          href="/dashboard/skills"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
        >
          <Code2 className="h-3 w-3" />
          DSA connected
          <span className="text-emerald-700/70 dark:text-emerald-300/70">
            · {platforms.length} platform{platforms.length === 1 ? "" : "s"}
          </span>
        </Link>
      )}
      {pubOk && (
        <a
          href={origin ? `${origin}/${slug}` : `/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/5 px-2.5 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-500/10 dark:text-sky-300"
        >
          <CheckCircle2 className="h-3 w-3" />
          Public profile live
          <span className="text-sky-700/70 dark:text-sky-300/70">· /{slug}</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  );
}
