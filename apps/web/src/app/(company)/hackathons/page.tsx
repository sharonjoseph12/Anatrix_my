import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewHackathonForm } from "./_components/new-hackathon-form";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  live: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export default async function RecruiterHackathonsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/hackathons");

  const { data: hackathons } = await supabase
    .from("hackathons")
    .select("id,title,status,starts_at,ends_at,created_at")
    .eq("recruiter_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-7 w-7" />
            Hackathons
          </h1>
          <p className="text-muted-foreground">
            Spin up a time-boxed coding challenge, fast-track top performers into your pipeline.
          </p>
        </div>
        <NewHackathonForm />
      </div>

      {hackathons && hackathons.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {hackathons.map((h) => (
            <Link key={h.id} href={`/hackathons/${h.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{h.title}</span>
                    <Badge variant={STATUS_VARIANT[h.status] ?? "outline"}>{h.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {fmtRange(h.starts_at, h.ends_at)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No hackathons yet</CardTitle>
            <CardDescription>
              Use the <Plus className="inline h-3 w-3" /> button above to create your first one. Drafts
              are not visible to students until you publish them.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <Button asChild size="sm" variant="ghost" className="px-1">
          <Link href="/dashboard">← Back to dashboard</Link>
        </Button>
      </p>
    </div>
  );
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(s)} → ${fmt.format(e)}`;
}
