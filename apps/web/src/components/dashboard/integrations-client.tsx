"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IntegrationStatus, type Integration } from "@/components/dashboard/integration-status";

export function IntegrationsClient({ integrations }: { integrations: Integration[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSync = async (provider: Integration["provider"]) => {
    const res = await fetch("/api/integrations/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Sync failed");
      throw new Error(body.error ?? "Sync failed");
    }

    const data = (await res.json()) as { synced: number };
    toast.success(
      provider === "github"
        ? `Synced ${data.synced} commits`
        : `Synced ${data.synced} events`,
    );
    startTransition(() => router.refresh());
  };

  return (
    <div aria-busy={isPending}>
      <IntegrationStatus integrations={integrations} onSync={handleSync} />
    </div>
  );
}
