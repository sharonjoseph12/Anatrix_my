import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecruiterLeaderboard } from "./_components/recruiter-leaderboard";
import { PublishButton } from "./_components/publish-button";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  live: "default",
  completed: "secondary",
  cancelled: "destructive",
};

type Props = { params: Promise<{ id: string }> };

export default async function RecruiterHackathonDetailPage({ params }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/hackathons");

  const { id } = await params;
  const { data: hack, error } = await supabase
    .from("hackathons")
    .select("id,recruiter_id,title,problem,test_cases_url,starts_at,ends_at,prize_structure,status,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !hack) notFound();
  const h = hack as {
    id: string;
    recruiter_id: string;
    title: string;
    problem: string;
    test_cases_url: string;
    starts_at: string;
    ends_at: string;
    prize_structure: Record<string, string>;
    status: string;
    created_at: string;
  };
  const isOwner = h.recruiter_id === user.id;

  const { count: submissionCount } = await supabase
    .from("hackathon_submissions")
    .select("id", { count: "exact", head: true })
    .eq("hackathon_id", h.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-7 w-7" />
            {h.title}
          </h1>
          <p className="text-muted-foreground">
            {new Date(h.starts_at).toLocaleString()} → {new Date(h.ends_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[h.status] ?? "outline"}>{h.status}</Badge>
          {isOwner && h.status === "draft" && <PublishButton id={h.id} />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Problem statement</CardTitle>
          <CardDescription>
            Test cases:
            <a
              href={h.test_cases_url}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-1 inline-flex items-center gap-1 text-primary underline"
            >
              open signed URL <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{h.problem}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Submissions" value={submissionCount ?? 0} />
        <Stat label="Window" value={`${Math.round((new Date(h.ends_at).getTime() - new Date(h.starts_at).getTime()) / 3_600_000)}h`} />
        <Stat label="Prize buckets" value={Object.keys(h.prize_structure).length} />
      </div>

      <RecruiterLeaderboard hackathonId={h.id} />

      <p className="text-xs text-muted-foreground">
        <Button asChild size="sm" variant="ghost" className="px-1">
          <Link href="/hackathons">← All hackathons</Link>
        </Button>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
