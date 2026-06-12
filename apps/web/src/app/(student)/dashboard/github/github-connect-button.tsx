"use client";

import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function GithubConnectButton() {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("sync=true")) {
      startTransition(async () => {
        await fetch("/api/integrations/github/sync", { method: "POST" });
        window.location.href = "/dashboard/github";
      });
    }
  }, []);

  function connect() {
    window.location.href = "/api/integrations/github/connect?next=/dashboard/github";
  }

  return (
    <Button onClick={connect} disabled={isPending}>
      {isPending ? "Connecting..." : "Connect GitHub"}
    </Button>
  );
}
