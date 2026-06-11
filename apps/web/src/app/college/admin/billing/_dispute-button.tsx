"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function DisputeButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (reason.trim().length < 10) {
      toast.error("Please provide at least 10 characters of context");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/outcome-billing/events/${eventId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to dispute event");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { reversed_at?: string | null };
      toast.success(
        body.reversed_at
          ? "Event disputed and reversed"
          : "Event disputed (outside 30-day window — recorded for review)",
      );
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertCircle className="h-3.5 w-3.5" />}
          Dispute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispute this placement charge</DialogTitle>
          <DialogDescription>
            Explain why the charge should be reversed (10–500 characters). If the
            event is within the 30-day window, it will be reversed immediately.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="The student withdrew the offer before joining…"
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || reason.trim().length < 10}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
