"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JoinCohortButton({
  cohortId,
  isMember,
}: {
  cohortId: string;
  isMember: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = async () => {
    if (isMember) {
      router.push(`/dashboard/cohorts/${cohortId}`);
      return;
    }
    const res = await fetch(`/api/cohorts/${cohortId}/join`, { method: "POST" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Failed to join");
      return;
    }
    toast.success("Joined cohort");
    startTransition(() => router.refresh());
    router.push(`/dashboard/cohorts/${cohortId}`);
  };

  return (
    <Button size="sm" onClick={onClick} disabled={isPending}>
      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
      <span className="ml-1">{isMember ? "Open" : "Join"}</span>
    </Button>
  );
}
