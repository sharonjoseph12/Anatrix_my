import { redirect } from "next/navigation";
import { Sparkles, Target, Code2, Clock, TrendingUp } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { computeSkillProofScore, proficiencyToNextThreshold } from "@/lib/algorithms/skill-proof-score";
import { computeProfileScore, profileTier } from "@/lib/algorithms/profile-score";
import { blendDsaIntoSkillProof, computeDsaScore } from "@/lib/algorithms/dsa-score";
import { DsaCard } from "@/components/dsa/dsa-card";

const PROFICIENCE_COLOR: Record<string, string> = {
  novice: "bg-muted text-muted-foreground",
  developing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  proficient: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  advanced: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  expert: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const TIER_LABEL: Record<string, string> = {
  explorer: "Explorer",
  builder: "Builder",
  proven: "Proven",
  elite: "Elite",
};

export default async function SkillsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/skills");

  const { data: userSkills } = await supabase
    .from("user_skills")
    .select(`
      id, hours_logged, projects_completed, avg_completion_rate, avg_focus_quality,
      hours_score, projects_score, quality_score, consistency_score,
      skill_proof_score, proficiency_level, last_project_date,
      skill:skills ( id, name, slug, category, avg_hours_to_proficiency )
    `)
    .eq("user_id", user.id)
    .order("skill_proof_score", { ascending: false });

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("overall_skill_proof_score, primary_specialization, placement_ready, total_hours_logged, total_projects_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: dsaProfiles } = await supabase
    .from("user_dsa_profiles")
    .select("platform,username,total_solved,easy_solved,medium_solved,hard_solved,contest_rating,streak_days,sync_status,last_synced_at")
    .eq("user_id", user.id)
    .in("sync_status", ["active", "pending"]);

  const scores = (userSkills ?? []).map((us) => us.skill_proof_score);
  const baseOverall = profile?.overall_skill_proof_score
    ?? computeProfileScore({ skillScores: scores, totalHoursLogged: 0 }).overall;
  const dsaScore = computeDsaScore((dsaProfiles ?? []).map((d) => ({
    platform: d.platform as "leetcode" | "hackerrank",
    easy_solved: d.easy_solved ?? 0,
    medium_solved: d.medium_solved ?? 0,
    hard_solved: d.hard_solved ?? 0,
    contest_rating: d.contest_rating,
    streak_days: d.streak_days ?? 0,
    total_solved: d.total_solved ?? 0,
  })));
  const overall = profile?.overall_skill_proof_score
    ? blendDsaIntoSkillProof(profile.overall_skill_proof_score, dsaScore.score)
    : baseOverall;
  const tier = profileTier(overall);
  const hoursLogged = (userSkills ?? []).reduce((sum, us) => sum + (us.hours_logged ?? 0), 0);
  const projectCount = (userSkills ?? []).reduce(
    (sum, us) => sum + (us.projects_completed ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skill Proof Profile</h1>
          <p className="text-muted-foreground">
            Verified scores from sessions, projects, and GitHub activity.
          </p>
        </div>
        <Badge
          className={`${PROFICIENCE_COLOR[tier === "elite" ? "expert" : tier === "proven" ? "advanced" : tier === "builder" ? "proficient" : "developing"]} w-fit`}
        >
          {TIER_LABEL[tier]} · {overall}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat
          icon={<Sparkles className="h-4 w-4" />}
          label="Overall score"
          value={`${overall}/100`}
        />
        <Stat
          icon={<Code2 className="h-4 w-4" />}
          label="Skills tracked"
          value={(userSkills ?? []).length}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Hours logged"
          value={hoursLogged}
        />
        <Stat
          icon={<Target className="h-4 w-4" />}
          label="Projects"
          value={projectCount}
        />
      </div>

      {profile?.placement_ready ? (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
              Placement ready
            </CardTitle>
            <CardDescription>
              Your verified profile is visible to recruiters. Specialization:{" "}
              <strong>{profile.primary_specialization ?? "generalist"}</strong>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Path to placement ready
            </CardTitle>
            <CardDescription>
              Hit score ≥ 80 and ≥ 200 hours logged. Currently: {overall} score ·{" "}
              {profile?.total_hours_logged ?? hoursLogged} hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Overall score</span>
                  <span>{overall} / 80</span>
                </div>
                <Progress value={Math.min(100, (overall / 80) * 100)} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Hours logged</span>
                  <span>
                    {profile?.total_hours_logged ?? hoursLogged} / 200
                  </span>
                </div>
                <Progress
                  value={Math.min(
                    100,
                    ((profile?.total_hours_logged ?? hoursLogged) / 200) * 100,
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dsaProfiles && dsaProfiles.length > 0 && (
        <DsaCard
          profiles={dsaProfiles.map((d) => ({
            platform: d.platform as "leetcode" | "hackerrank",
            username: d.username,
            total_solved: d.total_solved ?? 0,
            easy_solved: d.easy_solved ?? 0,
            medium_solved: d.medium_solved ?? 0,
            hard_solved: d.hard_solved ?? 0,
            contest_rating: d.contest_rating,
            streak_days: d.streak_days ?? 0,
            sync_status: d.sync_status,
            last_synced_at: d.last_synced_at,
          }))}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Per-skill breakdown</CardTitle>
          <CardDescription>
            Each skill&apos;s weighted score across hours, projects, quality, and consistency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userSkills && userSkills.length > 0 ? (
            <ul className="space-y-4">
              {userSkills.map((us) => {
                const skill = us.skill as unknown as {
                  name: string;
                  slug: string;
                  category: string;
                  avg_hours_to_proficiency: number | null;
                };
                const result = computeSkillProofScore({
                  hours_logged: us.hours_logged ?? 0,
                  projects_completed: us.projects_completed ?? 0,
                  avg_completion_rate: us.avg_completion_rate ?? 0,
                  avg_focus_quality: us.avg_focus_quality ?? 0,
                  avg_hours_to_proficiency: skill?.avg_hours_to_proficiency ?? null,
                });
                const next = proficiencyToNextThreshold(result.proficiency);
                return (
                  <li key={us.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{skill?.name ?? "Skill"}</p>
                        <p className="text-xs text-muted-foreground">
                          {skill?.category ?? "—"}
                          {us.last_project_date
                            ? ` · last project ${new Date(us.last_project_date).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={PROFICIENCE_COLOR[result.proficiency]}>
                          {result.proficiency} · {result.score}
                        </Badge>
                        {next.next && (
                          <span className="text-[10px] text-muted-foreground">
                            {next.threshold - result.score} pts to {next.next}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                      <ComponentBar
                        label="Hours"
                        value={result.components.hours}
                      />
                      <ComponentBar
                        label="Projects"
                        value={result.components.projects}
                      />
                      <ComponentBar
                        label="Quality"
                        value={result.components.quality}
                      />
                      <ComponentBar
                        label="Consistency"
                        value={result.components.consistency}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No skills yet. Track sessions and link GitHub to populate this view.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
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

function ComponentBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
