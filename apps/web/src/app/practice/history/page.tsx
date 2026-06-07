import { redirect } from "next/navigation";
import Link from "next/link";
import { History, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in_progress: "outline",
  completed: "secondary",
  abandoned: "destructive",
};

export default async function PracticeHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/practice/history");

  const { data: sessions } = await supabase
    .from("mock_interviews")
    .select("id,topic,status,rubric,score_contribution,total_tokens,started_at,completed_at")
    .eq("student_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-7 w-7" />
          Practice history
        </h1>
        <p className="text-muted-foreground">Past mock interviews and their rubrics.</p>
      </div>

      {sessions && sessions.length > 0 ? (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const session = s as {
              id: string;
              topic: string;
              status: string;
              rubric: { clarity: number; depth: number; correctness: number; summary: string } | null;
              score_contribution: number | null;
              total_tokens: number;
              started_at: string;
              completed_at: string | null;
            };
            return (
              <li key={session.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="truncate">{session.topic}</span>
                      <Badge variant={STATUS_VARIANT[session.status] ?? "outline"}>
                        {session.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Started {new Date(session.started_at).toLocaleString()} ·{" "}
                      {session.completed_at
                        ? `ended ${new Date(session.completed_at).toLocaleString()}`
                        : "in progress"}
                    </CardDescription>
                  </CardHeader>
                  {session.status === "completed" && session.rubric && (
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <Stat label="Clarity" value={session.rubric.clarity} />
                        <Stat label="Depth" value={session.rubric.depth} />
                        <Stat label="Correctness" value={session.rubric.correctness} />
                      </div>
                      {session.rubric.summary && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {session.rubric.summary}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        +{session.score_contribution ?? 0}% to verified score (weekly cap 5%).
                      </p>
                    </CardContent>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No mock interviews yet.{" "}
            <Button asChild size="sm" variant="link" className="px-1">
              <Link href="/practice/mock-interview">Start one →</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}/10</p>
    </div>
  );
}
