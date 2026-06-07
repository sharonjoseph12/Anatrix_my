import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PublicSkill = {
  name: string;
  proficiency: string;
  score: number;
  category?: string | null;
};

const PROF_COLOR: Record<string, string> = {
  expert: "text-emerald-700 dark:text-emerald-300",
  advanced: "text-violet-700 dark:text-violet-300",
  proficient: "text-sky-700 dark:text-sky-300",
  developing: "text-amber-700 dark:text-amber-300",
  novice: "text-muted-foreground",
};

export function SkillList({ skills }: { skills: PublicSkill[] }) {
  if (skills.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No skills tracked yet.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top skills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {skills.map((s) => (
          <div key={s.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                {s.category ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {s.category}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs capitalize ${PROF_COLOR[s.proficiency] ?? ""}`}>
                  {s.proficiency}
                </span>
                <span className="font-medium">{s.score}</span>
              </div>
            </div>
            <Progress value={s.score} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
