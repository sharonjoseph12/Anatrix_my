"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PrizeRow = { rank: string; reward: string };

export function NewHackathonForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [testCasesUrl, setTestCasesUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [prizes, setPrizes] = useState<PrizeRow[]>([
    { rank: "top_1", reward: "interview_fast_track" },
  ]);

  function setPrize(i: number, patch: Partial<PrizeRow>) {
    setPrizes((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function addPrize() {
    setPrizes((prev) => [...prev, { rank: "", reward: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const prize_structure: Record<string, string> = {};
    for (const p of prizes) {
      if (p.rank.trim()) prize_structure[p.rank.trim()] = p.reward.trim();
    }
    const body = {
      title: title.trim(),
      problem: problem.trim(),
      test_cases_url: testCasesUrl.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      prize_structure,
    };
    try {
      const res = await fetch("/api/hackathons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { hackathon_id?: string; error?: string };
      if (!res.ok || !data.hackathon_id) {
        setError(data.error ?? "Failed to create hackathon");
        return;
      }
      router.push(`/hackathons/${data.hackathon_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New hackathon
      </Button>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">New hackathon (draft)</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Problem statement (≥ 50 chars)</label>
            <Textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={5}
              maxLength={5000}
              required
            />
            <p className="text-[10px] text-muted-foreground">{problem.length}/5000</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Test cases URL (signed Supabase Storage URL)</label>
            <Input
              value={testCasesUrl}
              onChange={(e) => setTestCasesUrl(e.target.value)}
              type="url"
              placeholder="https://<project>.supabase.co/storage/v1/object/sign/..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Starts at</label>
              <Input
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                type="datetime-local"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ends at (24–168h later)</label>
              <Input
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                type="datetime-local"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prize structure</label>
            <div className="mt-1 space-y-1">
              {prizes.map((p, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="top_1"
                    value={p.rank}
                    onChange={(e) => setPrize(i, { rank: e.target.value })}
                  />
                  <Input
                    placeholder="interview_fast_track"
                    value={p.reward}
                    onChange={(e) => setPrize(i, { reward: e.target.value })}
                  />
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addPrize}>
                + Add row
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create draft"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
