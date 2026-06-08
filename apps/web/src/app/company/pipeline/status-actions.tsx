"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_FLOW: Array<{
  value: "reached_out" | "interview_scheduled" | "interview_completed" | "hired" | "rejected";
  label: string;
  tone: string;
}> = [
  { value: "reached_out", label: "Reached out", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { value: "interview_scheduled", label: "Schedule", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { value: "interview_completed", label: "Completed", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "hired", label: "Hired", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "rejected", label: "Reject", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
];

export function StatusActions({
  matchId,
  currentStatus,
}: {
  matchId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const setStatus = async (status: typeof STATUS_FLOW[number]["value"]) => {
    setBusy(status);
    try {
      const res = await fetch(`/api/job-matches/${matchId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to update");
        return;
      }
      toast.success(`Status set to ${status.replace("_", " ")}`);
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STATUS_FLOW.map((s) => {
        const active = currentStatus === s.value;
        return (
          <Button
            key={s.value}
            size="sm"
            variant="outline"
            className={cn("h-7 text-xs", active && s.tone)}
            onClick={() => setStatus(s.value)}
            disabled={busy !== null}
          >
            {busy === s.value && <Loader2 className="h-3 w-3 animate-spin" />}
            {s.label}
          </Button>
        );
      })}
    </div>
  );
}

export { Badge };
