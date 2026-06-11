"use client";

// T086 — Recruiter search filters: skills multi-select, min score, batch years,
// locations, Power-Mode-only toggle. Results list with score/match/verified summary.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Zap, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Result = {
  user_id: string;
  name: string;
  score: number;
  match_score: number;
  top_skills: string[];
  verified_activity_summary: string;
  power_mode_active: boolean;
};

const SKILL_OPTIONS = ["TypeScript", "Python", "Go", "Rust", "React", "Node.js", "Kubernetes", "Postgres", "Java", "Swift"];

export function RecruiterSearch() {
  const [skills, setSkills] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(60);
  const [batchYears, setBatchYears] = useState("");
  const [location, setLocation] = useState("");
  const [powerModeOnly, setPowerModeOnly] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [credit, setCredit] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const r = await supabase.functions.invoke("recruiter-credit", { body: {} });
      if (r.data) setCredit((r.data as { remaining: number }).remaining);
    })();
  }, []);

  async function search() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const r = await supabase.functions.invoke("recruiter-search", {
      body: { skills, min_score: minScore, batch_years: batchYears.split(",").map((b) => Number(b.trim())).filter(Boolean), location, power_mode_only: powerModeOnly },
    });
    if (r.data) {
      setResults((r.data as { results: Result[] }).results);
      setCredit((prev) => Math.max(0, (prev ?? 0) - 1));
    }
    setBusy(false);
  }

  function toggleSkill(s: string) {
    setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Search filters</span>
            {credit != null && <Badge variant="secondary">{credit} credits left</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Skills</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {SKILL_OPTIONS.map((s) => (
                <button key={s} onClick={() => toggleSkill(s)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${skills.includes(s) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Min score: {minScore}</p>
              <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Batch years (comma)</p>
              <Input value={batchYears} onChange={(e) => setBatchYears(e.target.value)} placeholder="2025,2026" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs"><Zap className="h-3 w-3" /> Power Mode only</span>
            <Switch checked={powerModeOnly} onCheckedChange={setPowerModeOnly} />
          </div>
          <Button onClick={search} disabled={busy || credit === 0} className="w-full">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run search"}
          </Button>
        </CardContent>
      </Card>

      {results && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No matches. Try widening the filters.</p>
      )}
      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <Card key={r.user_id}>
              <CardContent className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium flex items-center gap-1">
                    {r.name}
                    {r.power_mode_active && <Zap className="h-3 w-3 text-amber-500" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.verified_activity_summary}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.top_skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">{r.score}</p>
                  <p className="text-xs text-muted-foreground">match {r.match_score}%</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Find candidates</h1>
      <RecruiterSearch />
    </div>
  );
}
