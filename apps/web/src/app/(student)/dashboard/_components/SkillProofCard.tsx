"use client";

// T070 — SkillProofCard: shows the current 0-100 score with the component
// breakdown. Pulls live from the candidate_profiles row.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { GitBranch, CalendarDays, Activity, Users } from "lucide-react";

type Profile = {
  skill_proof_score: number;
  github_component: number | null;
  calendar_component: number | null;
  consistency_component: number | null;
  peer_component: number | null;
  power_mode_bonus_active: boolean | null;
  last_score_change_at: string | null;
};

export function SkillProofCard() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("candidate_profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(data as Profile);
    })();
  }, []);

  if (!profile) return <div className="h-40 animate-pulse rounded-md bg-muted" />;

  const components: Array<{ label: string; value: number; icon: React.ReactNode; weight: string }> = profile.power_mode_bonus_active
    ? [
        { label: "GitHub", value: profile.github_component ?? 0, icon: <GitBranch className="h-3 w-3" />, weight: "35%" },
        { label: "Session quality", value: profile.consistency_component ?? 0, icon: <Activity className="h-3 w-3" />, weight: "25%" },
        { label: "Consistency", value: profile.consistency_component ?? 0, icon: <CalendarDays className="h-3 w-3" />, weight: "20%" },
        { label: "Peer", value: profile.peer_component ?? 0, icon: <Users className="h-3 w-3" />, weight: "20%" },
      ]
    : [
        { label: "GitHub", value: profile.github_component ?? 0, icon: <GitBranch className="h-3 w-3" />, weight: "50%" },
        { label: "Consistency", value: profile.consistency_component ?? 0, icon: <CalendarDays className="h-3 w-3" />, weight: "20%" },
        { label: "Peer", value: profile.peer_component ?? 0, icon: <Users className="h-3 w-3" />, weight: "20%" },
        { label: "Calendar", value: profile.calendar_component ?? 0, icon: <Activity className="h-3 w-3" />, weight: "10%" },
      ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Skill Proof Score</CardTitle>
        {profile.power_mode_bonus_active && <Badge>Power Mode</Badge>}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums">{profile.skill_proof_score ?? 0}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <div className="mt-4 space-y-2">
          {components.map((c) => (
            <div key={c.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">{c.icon}{c.label}</span>
                <span className="text-muted-foreground">{Math.round(c.value)} · {c.weight}</span>
              </div>
              <Progress value={Math.min(100, Math.max(0, c.value))} className="h-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
