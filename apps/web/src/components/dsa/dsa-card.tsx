import { Code2, TrendingUp, Flame, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { computeDsaScore } from "@/lib/algorithms/dsa-score";

type DsaProfile = {
  platform: "leetcode" | "hackerrank";
  username: string;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating: number | null;
  streak_days: number;
  sync_status: string;
  last_synced_at: string;
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rate_limited: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  private: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  not_found: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  error: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function DsaCard({ profiles }: { profiles: DsaProfile[] }) {
  if (profiles.length === 0) return null;

  const { score, components } = computeDsaScore(profiles);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Code2 className="h-5 w-5 text-primary" />
              Problem solving (DSA)
            </CardTitle>
            <CardDescription>
              Solved problems, contest rating, and streak from your connected platforms.
            </CardDescription>
          </div>
          <Badge className={STATUS_TONE[profiles[0]?.sync_status ?? "active"] ?? STATUS_TONE.active}>
            {profiles[0]?.sync_status ?? "active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {profiles.map((p) => (
            <PlatformTile key={p.platform} profile={p} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SubStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Problem" value={components.problem} />
          <SubStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Contest" value={components.contest} />
          <SubStat icon={<Flame className="h-3.5 w-3.5" />} label="Streak" value={components.streak} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>DSA contribution to Skill Proof Score</span>
            <span className="font-medium">{score} / 100</span>
          </div>
          <Progress value={score} />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Last synced {new Date(profiles[0]?.last_synced_at ?? Date.now()).toLocaleString()}
          </span>
          {["private", "not_found", "error"].includes(profiles[0]?.sync_status ?? "") && (
            <Button asChild size="sm" variant="ghost">
              <Link href="/settings/sources">
                <RefreshCw className="h-3 w-3" />
                Reconnect
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformTile({ profile }: { profile: DsaProfile }) {
  const base =
    profile.platform === "leetcode"
      ? "https://leetcode.com/"
      : "https://www.hackerrank.com/profile/";
  return (
    <a
      href={`${base}${profile.username}`}
      target="_blank"
      rel="noreferrer"
      className="rounded-lg border bg-muted/30 p-3 transition-colors hover:border-primary"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium capitalize">{profile.platform}</span>
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </div>
      <p className="mt-1 text-xl font-semibold">{profile.total_solved}</p>
      <p className="text-[10px] text-muted-foreground">
        {profile.easy_solved}E · {profile.medium_solved}M · {profile.hard_solved}H
      </p>
      {profile.contest_rating !== null && profile.contest_rating > 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground">rating {profile.contest_rating}</p>
      )}
    </a>
  );
}

function SubStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}
