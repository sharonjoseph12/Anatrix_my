"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, MapPin, Code2, Star } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SearchCandidate {
  candidate_id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  match_score: number;
  primary_specialization: string | null;
  total_hours_logged: number;
  total_projects_completed: number;
  total_sessions: number;
  total_commits: number;
  avg_focus_quality: number | null;
  placement_ready: boolean;
  is_open_to_opportunities: boolean;
}

export function SearchForm() {
  const router = useRouter();
  const [skills, setSkills] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [minScore, setMinScore] = useState(60);
  const [batchYears, setBatchYears] = useState("");
  const [locations, setLocations] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SearchCandidate[] | null>(null);
  const [, startTransition] = useTransition();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        specialization: specialization.trim() || undefined,
        min_score: minScore,
        batch_years: batchYears.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n)),
        locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
        limit: 50,
      };
      const res = await fetch("/api/recruiter/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Search failed");
        return;
      }
      const data = (await res.json()) as { count: number; candidates: SearchCandidate[] };
      setResults(data.candidates);
      toast.success(`${data.count} candidates match your criteria`);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Search candidates
          </CardTitle>
          <CardDescription>
            All filters are optional. Public profiles + skill proof scores only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="skills">Required skills (comma-separated slugs)</Label>
                <Input
                  id="skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="algorithms,react,system-design"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization contains</Label>
                <Input
                  id="specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="algorithms, web, ml, …"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch">Batch years (e.g. 2026, 2027)</Label>
                <Input
                  id="batch"
                  value={batchYears}
                  onChange={(e) => setBatchYears(e.target.value)}
                  placeholder="2026, 2027"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locations">Locations</Label>
                <Input
                  id="locations"
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                  placeholder="Bangalore, Mumbai, Remote"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label htmlFor="min_score">Min skill proof score</Label>
                <span className="font-medium">{minScore}</span>
              </div>
              <input
                id="min_score"
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">Search candidates</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {results !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {results.length} result{results.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>Sorted by match score (highest first)</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches yet — try widening the filters.</p>
            ) : (
              <ul className="space-y-3">
                {results.map((c) => (
                  <li
                    key={c.candidate_id}
                    className="rounded-md border p-3 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {c.display_name ?? c.email ?? c.user_id.slice(0, 8)}
                          </p>
                          {c.placement_ready && (
                            <Badge variant="default" className="gap-1">
                              <Star className="h-3 w-3" />
                              ready
                            </Badge>
                          )}
                          {c.is_open_to_opportunities && (
                            <Badge variant="secondary">open</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.primary_specialization ?? "—"} · {c.total_hours_logged}h
                          · {c.total_projects_completed} projects · {c.total_commits} commits
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1 md:grid-cols-4">
                          <Micro label="Score" value={String(c.match_score)} />
                          <Micro label="Focus" value={`${Math.round((c.avg_focus_quality ?? 0) * 100)}%`} />
                          <Micro label="Sessions" value={String(c.total_sessions)} />
                          <Micro label="Specialization" value={c.primary_specialization ?? "—"} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-2xl font-bold">{c.match_score}</p>
                          <p className="text-xs text-muted-foreground">match</p>
                        </div>
                        <Progress value={c.match_score} className="w-24" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/company/pipeline?candidate=${c.candidate_id}`}>
                          <MapPin className="mr-1 h-3 w-3" />
                          Schedule
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <a href={`mailto:${c.email ?? ""}`}>Reach out</a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Micro({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-xs font-medium">{value}</p>
    </div>
  );
}

export { Code2 };
