"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AppealFormProps {
  signalId: string;
}

export function AppealForm({ signalId }: AppealFormProps) {
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setExplanation("");
    setEvidenceUrl("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (explanation.trim().length < 30) {
      setError("Please write at least 30 characters explaining your appeal.");
      return;
    }
    const body: { signal_id: string; explanation: string; evidence_url?: string } = {
      signal_id: signalId,
      explanation: explanation.trim(),
    };
    if (evidenceUrl.trim()) body.evidence_url = evidenceUrl.trim();

    startTransition(async () => {
      try {
        const res = await fetch("/api/anticheat/appeal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? `Request failed (${res.status})`);
          return;
        }
        setSubmitted(true);
        setOpen(false);
        reset();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (submitted) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Appeal filed — a mentor will review it shortly. This page will refresh when the
        decision is made.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          File an appeal
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border bg-background/60 p-3">
      <div className="space-y-1">
        <Label htmlFor={`explanation-${signalId}`}>
          Explanation <span className="text-muted-foreground">(min 30 chars)</span>
        </Label>
        <Textarea
          id={`explanation-${signalId}`}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={4}
          placeholder="Explain why this signal is a false positive. Reference your commit history, walkthrough video, or any other context that proves the work is yours."
          maxLength={2000}
        />
        <p className="text-[10px] text-muted-foreground">{explanation.length} / 2000</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`evidence-${signalId}`} className="text-xs">
          Evidence URL <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`evidence-${signalId}`}
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://github.com/.../commit/... or https://youtu.be/..."
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isPending ? "Submitting…" : "Submit appeal"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
