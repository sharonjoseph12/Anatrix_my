"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IntegrationStatus, type Integration } from "@/components/dashboard/integration-status";

export function IntegrationsClient({ integrations }: { integrations: Integration[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSync = useCallback(async (provider: Integration["provider"]) => {
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
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.location.search.includes("sync=true")) return;
    const hasGithub = integrations.some((i) => i.provider === "github");
    if (!hasGithub) return;
    void handleSync("github").finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("sync");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    });
  }, [handleSync, integrations]);

  return (
    <div aria-busy={isPending}>
      <IntegrationStatus integrations={integrations} onSync={handleSync} />
    </div>
  );
}
