import { ShieldAlert, ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppealForm } from "./appeal-form";

interface QuarantinedSignal {
  id: string;
  entity_id: string;
  entity_type: "github_repo" | "dsa_record";
  signal: string;
  confidence: number;
  detected_at: string;
  evidence_payload: Record<string, unknown> | null;
}

const SIGNAL_LABEL: Record<string, string> = {
  fork_no_commits: "Fork with no commits",
  commit_cluster_time: "Commit cluster in a 30-min window",
  ai_generated_suspect: "AI-generated fingerprint",
  copied_content_overlap: "High overlap with a public repo",
  impossible_velocity: "Impossible solve velocity",
  rating_delta_anomaly: "Contest rating delta anomaly",
};

const PLATFORM_LABEL: Record<string, string> = {
  leetcode: "LeetCode",
  hackerrank: "HackerRank",
};

export async function AnticheatBanner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: quarantinedRepos } = await supabase
    .from("anticheat_signals")
    .select("id, entity_id, entity_type, signal, confidence, detected_at, evidence_payload")
    .eq("student_id", user.id)
    .is("superseded_by", null)
    .eq("entity_type", "github_repo")
    .order("detected_at", { ascending: false })
    .returns<QuarantinedSignal[]>();

  const { data: quarantinedDsa } = await supabase
    .from("anticheat_signals")
    .select("id, entity_id, entity_type, signal, confidence, detected_at, evidence_payload")
    .eq("student_id", user.id)
    .is("superseded_by", null)
    .eq("entity_type", "dsa_record")
    .order("detected_at", { ascending: false })
    .returns<QuarantinedSignal[]>();

  const { data: pendingAppeals } = await supabase
    .from("anticheat_appeals")
    .select("signal_id, status")
    .eq("student_id", user.id)
    .in("status", ["pending", "approved"])
    .returns<Array<{ signal_id: string; status: string }>>();

  const appealedSignalIds = new Set((pendingAppeals ?? []).map((a) => a.signal_id));

  const repoItems = (quarantinedRepos ?? []).filter((s) => !appealedSignalIds.has(s.id));
  const dsaItems = (quarantinedDsa ?? []).filter((s) => !appealedSignalIds.has(s.id));

  if (repoItems.length === 0 && dsaItems.length === 0) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-5 w-5" />
          {repoItems.length + dsaItems.length} item{repoItems.length + dsaItems.length === 1 ? "" : "s"} under review
        </CardTitle>
        <CardDescription>
          These were flagged by our anti-cheat detectors and are excluded from your Skill Proof Score
          until a mentor reviews your appeal. Submit an explanation with optional evidence
          (commit history, video walkthrough) and a college mentor will decide.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {repoItems.map((s) => {
          const repoFullName =
            (s.evidence_payload?.["repo_full_name"] as string | undefined) ??
            s.entity_id.slice(0, 8);
          return (
            <div key={s.id} className="rounded-md border bg-background/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{repoFullName}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {SIGNAL_LABEL[s.signal] ?? s.signal} · confidence {Math.round(s.confidence * 100)}%
                    {" · "}detected {new Date(s.detected_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="warning">Quarantined</Badge>
              </div>
              <AppealForm signalId={s.id} />
            </div>
          );
        })}
        {dsaItems.map((s) => {
          const platform = (s.evidence_payload?.["platform"] as string | undefined) ?? "";
          return (
            <div key={s.id} className="rounded-md border bg-background/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {PLATFORM_LABEL[platform] ?? (platform || "DSA profile")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {SIGNAL_LABEL[s.signal] ?? s.signal} · confidence {Math.round(s.confidence * 100)}%
                    {" · "}detected {new Date(s.detected_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="warning">Quarantined</Badge>
              </div>
              <AppealForm signalId={s.id} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
