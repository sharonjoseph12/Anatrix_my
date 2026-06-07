// apps/web/src/app/(student)/dashboard/skills/next-best-skill.tsx
// 11/10 — Next-Best-Skill dashboard widget (US3, FR-NBS-001..005).
//
// Server component. Reads public.next_best_skills for the signed-in
// student (top 3 by rank) and renders a card list. If the table has
// no rows for the student, returns null so the page chrome stays
// clean (FR-NBS-003: hide when there is no low-signal noise).
//
// The "Mark as learning" / "View resources" buttons are visual stubs
// in v1; they are NOT wired to the backend. Wiring them up is part of
// the v1.1 follow-up alongside the public learning-resources surface.

import { Lightbulb, ExternalLink, BookmarkPlus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NbsRow {
  id: string;
  skill: string;
  rank: number;
  source_count: number;
  confidence: number;
  reasoning: string;
  computed_at: string;
}

export async function NextBestSkill() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows, error } = await supabase
    .from("next_best_skills")
    .select("id, skill, rank, source_count, confidence, reasoning, computed_at")
    .eq("student_id", user.id)
    .order("rank", { ascending: true })
    .limit(3)
    .returns<NbsRow[]>();

  if (error) {
    // A failed read should never crash the dashboard; surface a quiet
    // server-side error and hide the widget. The user can still see
    // their skills, DSA, and anti-cheat banners.
    console.error("next_best_skills read failed", error);
    return null;
  }
  if (!rows || rows.length === 0) return null;

  return (
    <Card className="border-sky-500/40 bg-sky-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" />
          Next-Best-Skill Recommendations
        </CardTitle>
        <CardDescription>
          Skills that similar alumni (≥ 60% Jaccard match on your
          current stack) added after getting placed. Refreshed daily by
          the recommender.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div
            key={`next-best-skill-${r.skill}`}
            className="rounded-md border bg-background/40 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.skill}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.reasoning}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {Math.round(r.confidence * 100)}% confidence
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                disabled
                title="Coming soon: track skills you're learning"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Mark as learning
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                disabled
                title="Coming soon: curated learning resources"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View resources
              </button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
