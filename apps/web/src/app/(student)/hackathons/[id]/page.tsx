import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentLeaderboard } from "./_components/student-leaderboard";
import { SubmissionForm } from "./_components/submission-form";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  live: "default",
  completed: "secondary",
  cancelled: "destructive",
};

type Props = { params: Promise<{ id: string }> };

export default async function StudentHackathonDetailPage({ params }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/hackathons");

  const { id } = await params;
  const { data: hack, error } = await supabase
    .from("hackathons")
    .select("id,title,problem,test_cases_url,starts_at,ends_at,prize_structure,status")
    .eq("id", id)
    .maybeSingle();
  if (error || !hack) notFound();
  const h = hack as {
    id: string;
    title: string;
    problem: string;
    test_cases_url: string;
    starts_at: string;
    ends_at: string;
    prize_structure: Record<string, string>;
    status: string;
  };

  // The student's own submissions for this hackathon.
  const { data: mySubs } = await supabase
    .from("hackathon_submissions")
    .select("id,language,score,submitted_at,graded_at")
    .eq("hackathon_id", h.id)
    .eq("student_id", user.id)
    .order("submitted_at", { ascending: false });

  const now = Date.now();
  const inWindow = now >= new Date(h.starts_at).getTime() && now <= new Date(h.ends_at).getTime();
  const isLive = h.status === "live" && inWindow;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="h-7 w-7" />
          {h.title}
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[h.status] ?? "outline"}>{h.status}</Badge>
          <p className="text-sm text-muted-foreground">
            Ends {new Date(h.ends_at).toLocaleString()}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Problem</CardTitle>
          <CardDescription>
            Public test cases:
            <a
              href={h.test_cases_url}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-1 inline-flex items-center gap-1 text-primary underline"
            >
              download <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{h.problem}</p>
        </CardContent>
      </Card>

      {h.prize_structure && Object.keys(h.prize_structure).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prizes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
              {Object.entries(h.prize_structure).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between rounded border p-2">
                  <span className="font-mono text-xs">{k}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isLive ? (
        <SubmissionForm hackathonId={h.id} />
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Submissions are not open. The window is {new Date(h.starts_at).toLocaleString()} → {new Date(h.ends_at).toLocaleString()}.
          </CardContent>
        </Card>
      )}

      {mySubs && mySubs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {mySubs.map((s) => {
                const sub = s as { id: string; language: string; score: number | null; submitted_at: string; graded_at: string | null };
                return (
                  <li key={sub.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{sub.language}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sub.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums">{sub.score ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {sub.graded_at ? "graded" : "pending"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <StudentLeaderboard hackathonId={h.id} />

      <p className="text-xs text-muted-foreground">
        <Button asChild size="sm" variant="ghost" className="px-1">
          <Link href="/hackathons">← All hackathons</Link>
        </Button>
      </p>
    </div>
  );
}
