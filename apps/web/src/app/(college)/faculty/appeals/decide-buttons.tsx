"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface DecideButtonsProps {
  appealId: string;
}

export function DecideButtons({ appealId }: DecideButtonsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "approved" | "rejected">(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "approved" | "rejected">(null);
  const [isPending, startTransition] = useTransition();

  function submit(decision: "approved" | "rejected") {
    setError(null);
    const body: { appeal_id: string; decision: "approved" | "rejected"; mentor_note?: string } = {
      appeal_id: appealId,
      decision,
    };
    if (note.trim()) body.mentor_note = note.trim();

    startTransition(async () => {
      try {
        const res = await fetch("/api/anticheat/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? `Request failed (${res.status})`);
          return;
        }
        setDone(decision);
        setOpen(null);
        setNote("");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (done) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        {done === "approved" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        Marked {done}. The list will refresh shortly.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button size="sm" onClick={() => setOpen("approved")}>
          Approve
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setOpen("rejected")}>
          Reject
        </Button>
      </div>
    );
  }

  const decision = open;
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <Label htmlFor={`note-${appealId}`} className="text-xs">
        Mentor note <span className="text-muted-foreground">(optional, max 2000 chars)</span>
      </Label>
      <Textarea
        id={`note-${appealId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder={
          decision === "approved"
            ? "Why the appeal is approved (e.g. commit history shows original work)."
            : "Why the appeal is rejected (e.g. explanation does not address the signal)."
        }
        maxLength={2000}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={decision === "approved" ? "default" : "destructive"}
          onClick={() => submit(decision)}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isPending ? "Submitting…" : `Confirm ${decision}`}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(null);
            setNote("");
            setError(null);
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
