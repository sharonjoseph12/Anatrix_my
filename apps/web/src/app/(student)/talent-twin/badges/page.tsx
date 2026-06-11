import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, GitCommit } from "lucide-react";
import { IssueBadgeButton } from "./issue-badge-button";

export default async function BadgesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: commits } = await supabase
    .from("github_commits")
    .select("sha, repo, message, lines_added, committed_at")
    .eq("user_id", user.id)
    .order("committed_at", { ascending: false })
    .limit(100);

  const { data: chunks } = await supabase
    .from("talent_twin_chunks")
    .select("metadata")
    .eq("user_id", user.id);

  const badgedNonces = new Set<string>();
  for (const c of chunks ?? []) {
    const meta = c.metadata as Record<string, unknown>;
    const nonce = meta?.badge_nonce as string | undefined;
    if (nonce) badgedNonces.add(nonce);
  }

  const existingBadges = chunks?.filter((c) => {
    const meta = c.metadata as Record<string, unknown>;
    return meta?.badge_nonce && meta?.badge_jwt;
  }) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Authorship Badges</h1>
        <p className="text-muted-foreground mt-1">
          Issue verifiable badges for commits you authored. Each badge proves your
          contribution with a cryptographic signature.
        </p>
      </div>

      {existingBadges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Your Badges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {existingBadges.map((b, i) => {
              const meta = b.metadata as Record<string, unknown>;
              return (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{meta?.label as string ?? "Badge"}</p>
                      <p className="text-sm text-muted-foreground">
                        {(meta?.commits as string[])?.length ?? 0} commits ·{" "}
                        {(meta?.total_lines as number)?.toLocaleString() ?? 0} lines
                      </p>
                    </div>
                    <Badge variant="secondary">Issued</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Claimable Commits
          </CardTitle>
          <CardDescription>
            Select commits to include in your badge. Commits with fewer than 10 lines
            added are excluded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!commits || commits.length === 0) ? (
            <p className="text-sm text-muted-foreground">
              No GitHub commits found. Connect your GitHub account first.
            </p>
          ) : (
            <IssueBadgeButton
              commits={commits
                .filter((c) => (c.lines_added ?? 0) >= 10)
                .slice(0, 50)
                .map((c) => ({
                  sha: c.sha,
                  repo: c.repo ?? "",
                  message: c.message ?? "",
                  lines_added: c.lines_added ?? 0,
                  committed_at: c.committed_at ?? "",
                }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
