"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Award } from "lucide-react";

interface CommitItem {
  sha: string;
  repo: string;
  message: string;
  lines_added: number;
  committed_at: string;
}

export function IssueBadgeButton({ commits }: { commits: CommitItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    badge_id?: string;
    svg?: string;
    jwt?: string;
    error?: string;
  } | null>(null);

  function toggle(sha: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sha)) next.delete(sha);
      else next.add(sha);
      return next;
    });
  }

  async function issueBadge() {
    if (selected.size === 0) return;
    startTransition(async () => {
      setResult(null);
      try {
        const tokenRes = await fetch("/api/auth/token").then((r) => r.json());
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/talent-twin-badge-issue`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenRes.token}`,
            },
            body: JSON.stringify({
              commits: Array.from(selected),
              label: label || undefined,
            }),
          },
        );
        const data = await res.json();
        if (res.ok) setResult(data);
        else setResult({ error: data.error?.message ?? "Failed to issue badge" });
      } catch {
        setResult({ error: "Network error" });
      }
    });
  }

  if (result?.badge_id) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="p-6 text-center space-y-3">
            <Award className="h-10 w-10 mx-auto text-emerald-600" />
            <p className="font-semibold text-lg">Badge Issued!</p>
            <p className="text-sm text-muted-foreground">Badge ID: {result.badge_id}</p>
            {result.svg && (
              <div
                className="mx-auto max-w-xs"
                dangerouslySetInnerHTML={{ __html: result.svg }}
              />
            )}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.jwt ?? "");
                }}
              >
                Copy JWT
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setResult(null)}
              >
                Issue Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCount = selected.size;
  const selectedLines = commits
    .filter((c) => selected.has(c.sha))
    .reduce((sum, c) => sum + c.lines_added, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 max-w-sm">
        <Label htmlFor="label">Badge Label (optional)</Label>
        <Input
          id="label"
          placeholder="e.g. Qdrant contributions 2026"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="max-h-96 overflow-y-auto space-y-1 border rounded-lg">
        {commits.map((c) => (
          <label
            key={c.sha}
            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
          >
            <Checkbox
              checked={selected.has(c.sha)}
              onChange={() => toggle(c.sha)}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate font-medium">{c.message}</p>
              <p className="text-xs text-muted-foreground">
                {c.repo} · +{c.lines_added} lines · {new Date(c.committed_at).toLocaleDateString()}
              </p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 font-mono">
              {c.sha.slice(0, 7)}
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedCount} commits selected · {selectedLines.toLocaleString()} lines total
        </p>
        <Button
          onClick={issueBadge}
          disabled={selectedCount === 0 || isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Issue Badge
        </Button>
      </div>

      {result?.error && (
        <p className="text-sm text-destructive">{result.error}</p>
      )}
    </div>
  );
}
