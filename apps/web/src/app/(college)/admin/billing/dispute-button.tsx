// apps/web/src/app/(college)/admin/billing/dispute-button.tsx
// 11/10 — Client form for disputing an outcome billing event.
// Mirrors the appeal-form.tsx pattern: minimal in-component form,
// POSTs to /api/outcome-billing/events/[id]/dispute, refreshes the
// page on success so the parent server component re-renders the
// updated row state.

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DisputeButtonProps {
  eventId: string;
}

export function DisputeButton({ eventId }: DisputeButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/outcome-billing/events/${eventId}/dispute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: trimmed }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? `Request failed (${res.status})`);
          return;
        }
        const j = (await res.json().catch(() => ({}))) as { reversed_at?: string | null };
        toast.success(
          j.reversed_at
            ? "Dispute filed and charge reversed."
            : "Dispute filed. The charge is outside the reversal window.",
        );
        setOpen(false);
        setReason("");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        Dispute
      </button>
    );
  }

  return (
    <div className="ml-auto w-72 space-y-2 rounded-md border bg-background/60 p-3 text-left">
      <label className="block text-xs font-medium" htmlFor={`reason-${eventId}`}>
        Reason (min 10 chars)
      </label>
      <textarea
        id={`reason-${eventId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Why is this charge being disputed?"
        className="flex w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-2.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {pending ? "Submitting…" : "Confirm dispute"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          disabled={pending}
          className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
