import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  live: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export default async function StudentHackathonsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/hackathons");

  // Only show live + recently completed hackathons; drafts are
  // recruiter-only.
  const { data: live } = await supabase
    .from("hackathons")
    .select("id,title,problem,starts_at,ends_at,status,prize_structure")
    .eq("status", "live")
    .order("ends_at", { ascending: true })
    .limit(20);
  const { data: recent } = await supabase
    .from("hackathons")
    .select("id,title,problem,starts_at,ends_at,status,prize_structure")
    .eq("status", "completed")
    .order("ends_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="h-7 w-7" />
          Hackathons
        </h1>
        <p className="text-muted-foreground">
          Time-boxed coding challenges from recruiters. Top performers get fast-tracked to interview.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Live
        </h2>
        {live && live.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {live.map((h) => (
              <Link key={h.id} href={`/hackathons/${h.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="truncate">{h.title}</span>
                      <Badge variant={STATUS_VARIANT[h.status] ?? "outline"}>{h.status}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Ends {new Date(h.ends_at).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{h.problem}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No live hackathons right now. Check back soon.
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent
        </h2>
        {recent && recent.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recent.map((h) => (
              <Link key={h.id} href={`/hackathons/${h.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="truncate">{h.title}</span>
                      <Badge variant={STATUS_VARIANT[h.status] ?? "outline"}>{h.status}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Ended {new Date(h.ends_at).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
