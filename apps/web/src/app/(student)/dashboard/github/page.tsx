import { redirect } from "next/navigation";
import { Github, GitCommit, Code2, FolderGit2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntegrationsClient } from "@/components/dashboard/integrations-client";
import type { Integration } from "@/components/dashboard/integration-status";

export default async function GitHubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/github");

  const { data: account } = await supabase
    .from("github_accounts")
    .select("id,username,status,last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const integrations: Integration[] = [
    {
      provider: "github",
      status: account
        ? (account.status as Integration["status"])
        : "not_connected",
      username: account?.username ?? null,
      last_synced_at: account?.last_synced_at ?? null,
    },
  ];

  if (!account) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GitHub Activity</h1>
          <p className="text-muted-foreground">
            Sync your commit history to enrich your verified skill profile.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Connect GitHub
            </CardTitle>
            <CardDescription>
              We&apos;ll fetch your public commits, languages, and repositories every
              2 hours. No write access to your repos — read-only is enough.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/integrations/github/connect">Connect GitHub</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: recentCommits } = await supabase
    .from("github_activity")
    .select("id,commit_hash,repo_full_name,primary_language,additions,deletions,files_changed,message,committed_at")
    .eq("user_id", user.id)
    .order("committed_at", { ascending: false })
    .limit(20);

  let languageStats: Array<{ language: string; commit_count: number; pct: number }> | null = null;
  try {
    const res = await supabase.rpc("github_language_breakdown", { p_user_id: user.id });
    languageStats = (res.data as Array<{ language: string; commit_count: number; pct: number }> | null) ?? null;
  } catch {
    languageStats = null;
  }

  // Fallback: aggregate in TS if RPC is not yet defined
  let langs: Array<{ language: string; commit_count: number; pct: number }> = languageStats ?? [];
  if (langs.length === 0 && recentCommits && recentCommits.length > 0) {
    const counts = new Map<string, number>();
    for (const c of recentCommits) {
      const lang = c.primary_language ?? "Unknown";
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    langs = Array.from(counts.entries())
      .map(([language, commit_count]) => ({
        language,
        commit_count,
        pct: Math.round((commit_count / total) * 100),
      }))
      .sort((a, b) => b.commit_count - a.commit_count);
  }

  const { data: repos } = await supabase
    .from("github_activity")
    .select("repo_full_name,repo_name,primary_language,committed_at")
    .eq("user_id", user.id)
    .order("committed_at", { ascending: false })
    .limit(200);

  const repoMap = new Map<string, { name: string; language: string | null; lastCommit: string }>();
  for (const r of repos ?? []) {
    if (!repoMap.has(r.repo_full_name)) {
      repoMap.set(r.repo_full_name, {
        name: r.repo_name,
        language: r.primary_language,
        lastCommit: r.committed_at,
      });
    }
  }
  const repoList = Array.from(repoMap.entries())
    .map(([full_name, v]) => ({ full_name, ...v }))
    .sort((a, b) => b.lastCommit.localeCompare(a.lastCommit))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Github className="h-7 w-7" />
            GitHub Activity
          </h1>
          <p className="text-muted-foreground">
            @{account.username} · auto-synced every 2 hours
          </p>
        </div>
        <Badge variant={account.status === "active" ? "default" : "destructive"}>
          {account.status}
        </Badge>
      </div>

      <IntegrationsClient integrations={integrations} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<GitCommit className="h-4 w-4" />}
          label="Commits (90d)"
          value={recentCommits?.length ?? 0}
        />
        <SummaryCard
          icon={<Code2 className="h-4 w-4" />}
          label="Languages"
          value={langs.length}
        />
        <SummaryCard
          icon={<FolderGit2 className="h-4 w-4" />}
          label="Active repos"
          value={repoList.length}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent commits</CardTitle>
            <CardDescription>Most recent activity across all repos</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCommits && recentCommits.length > 0 ? (
              <ul className="divide-y">
                {recentCommits.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.message.split("\n")[0] || "(no message)"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.repo_full_name} · {c.primary_language ?? "unknown"}
                          {c.additions != null && c.deletions != null
                            ? ` · +${c.additions} / -${c.deletions}`
                            : ""}
                        </p>
                      </div>
                      <time
                        dateTime={c.committed_at}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {new Date(c.committed_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No commits synced yet. Trigger a manual sync above.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Languages</CardTitle>
            </CardHeader>
            <CardContent>
              {langs.length > 0 ? (
                <ul className="space-y-2">
                  {langs.slice(0, 6).map((l) => (
                    <li key={l.language} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{l.language}</span>
                        <span className="text-muted-foreground">
                          {l.commit_count} ({l.pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${l.pct}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top repositories</CardTitle>
            </CardHeader>
            <CardContent>
              {repoList.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {repoList.map((r) => (
                    <li
                      key={r.full_name}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{r.name}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {r.language ?? "—"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
