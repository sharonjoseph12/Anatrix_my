"use client";

// T030 — slim 3-field profile form per spec/002 Day-1 mandate (under 3 minutes total onboarding).
// Replaces the 001 form's working_hours fields — the system derives peak hours from real data.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const GOAL_OPTIONS = ["Placement", "DSA", "AI/ML", "Startup", "Research", "Freelancing", "Open Source"] as const;
const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
] as const;

export function ProfileSetupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState<string>("");
  const [leetcode, setLeetcode] = useState("");
  const [hackerrank, setHackerrank] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleGoal(g: string) {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!displayName.trim()) return setError("Display name is required");
    if (goals.length === 0) return setError("Pick at least one goal");
    if (!skillLevel) return setError("Choose your skill level");

    const supabase = createSupabaseBrowserClient();
    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setError("Not signed in");
      const { error: upErr } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (upErr) return setError(upErr.message);
      const { error: profileError } = await supabase.from("users").update({
        display_name: displayName,
        goals,
        skill_level: skillLevel,
        onboarding_step: "dashboard",
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (profileError) return setError(profileError.message);

      // Fire-and-forget DSA connect (best-effort, doesn't block onboarding)
      const connects: Array<Promise<unknown>> = [];
      if (leetcode.trim()) {
        connects.push(
          fetch("/api/dsa/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: "leetcode", username: leetcode.trim() }),
          }).catch(() => null),
        );
      }
      if (hackerrank.trim()) {
        connects.push(
          fetch("/api/dsa/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: "hackerrank", username: hackerrank.trim() }),
          }).catch(() => null),
        );
      }
      await Promise.all(connects);

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Almost done</CardTitle>
        <CardDescription>Three quick picks. You can change them any time.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sharon Dave"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>What&apos;s your goal?</Label>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((g) => {
                const active = goals.includes(g);
                return (
                  <button
                    type="button"
                    key={g}
                    onClick={() => toggleGoal(g)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Current skill level</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SKILL_LEVELS.map((l) => {
                const active = skillLevel === l.value;
                return (
                  <button
                    type="button"
                    key={l.value}
                    onClick={() => setSkillLevel(l.value)}
                    className={`rounded-md border p-2 text-sm transition-colors ${
                      active ? "border-primary bg-primary/5" : "border-input hover:bg-accent"
                    }`}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-dashed bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Optional: prove your DSA</p>
              <p className="text-xs text-muted-foreground">
                Add your LeetCode or HackerRank username to count solved problems toward your Skill Proof Score.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="leetcode">LeetCode username</Label>
                <Input
                  id="leetcode"
                  value={leetcode}
                  onChange={(e) => setLeetcode(e.target.value)}
                  placeholder="sharon-dave"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hackerrank">HackerRank username</Label>
                <Input
                  id="hackerrank"
                  value={hackerrank}
                  onChange={(e) => setHackerrank(e.target.value)}
                  placeholder="sharon_d"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Go to dashboard →"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
