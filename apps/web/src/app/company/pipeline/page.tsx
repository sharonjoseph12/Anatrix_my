import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusActions } from "./status-actions";

export default async function PipelinePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/company/pipeline");

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  const companyId = (membership as { company_id: string }).company_id;

  const { data: matches } = await supabase
    .from("job_matches")
    .select(`
      id, status, position_title, match_score, notes,
      reached_out_at, interview_scheduled_at, interview_completed_at, hired_at, created_at,
      candidate_id, candidate:candidate_profiles(user_id, primary_specialization, skill_proof_score)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const list = (matches ?? []) as Array<{
    id: string;
    status: string;
    position_title: string | null;
    match_score: number;
    notes: string | null;
    reached_out_at: string | null;
    interview_scheduled_at: string | null;
    interview_completed_at: string | null;
    hired_at: string | null;
    created_at: string;
    candidate_id: string;
  }>;

  // Hydrate candidate users
  const userIds = (matches ?? [])
    .map((m) => (m as unknown as { candidate?: { user_id: string } | null }).candidate?.user_id)
    .filter((id): id is string => Boolean(id));
  const { data: usersData } = userIds.length
    ? await supabase.from("users").select("id,email,display_name").in("id", userIds)
    : { data: [] as Array<{ id: string; email: string | null; display_name: string | null }> };
  const userMap = new Map<string, { id: string; email: string | null; display_name: string | null }>();
  for (const u of usersData ?? []) userMap.set(u.id, u);

  const groups: Record<string, typeof list> = {
    matched: [],
    reached_out: [],
    interview_scheduled: [],
    interview_completed: [],
    hired: [],
    rejected: [],
  };
  for (const m of list) {
    const bucket = groups[m.status] ?? groups.matched;
    if (bucket) bucket.push(m);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-7 w-7" />
            Hiring pipeline
          </h1>
          <p className="text-muted-foreground">
            {list.length} candidate{list.length === 1 ? "" : "s"} in your funnel.
          </p>
        </div>
        <Button asChild>
          <Link href="/company/search">Search more</Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No candidates in your pipeline yet</CardTitle>
            <CardDescription>Run a search and add candidates to start tracking them here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(groups).map(([status, items]) =>
            items.length === 0 ? null : (
              <Card key={status}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base capitalize">
                      {status.replace("_", " ")}
                    </CardTitle>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((m) => {
                    const c = (m as unknown as { candidate?: { user_id: string; primary_specialization: string | null; skill_proof_score: number | null } | null }).candidate;
                    const u = c ? userMap.get(c.user_id) : null;
                    return (
                      <div key={m.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {u?.display_name ?? u?.email ?? m.candidate_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c?.primary_specialization ?? "—"} · score {c?.skill_proof_score ?? 0}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {m.position_title ?? "Verified candidate"} · match {m.match_score}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <StatusActions matchId={m.id} currentStatus={status} />
                        </div>
                        {m.interview_scheduled_at && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Scheduled: {new Date(m.interview_scheduled_at).toLocaleString()}
                          </p>
                        )}
                        {m.notes && (
                          <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">
                            {m.notes}
                          </p>
                        )}
                        <div className="mt-2 flex justify-end">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/company/pipeline/schedule?candidate=${m.candidate_id}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
