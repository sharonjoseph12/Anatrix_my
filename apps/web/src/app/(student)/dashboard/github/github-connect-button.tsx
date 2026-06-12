"use client";

import { useTransition, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.linkIdentity({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/github`,
        },
      });
      if (error) {
        if (error.message.includes("already linked")) {
          // Already linked in auth.identities, but missing in github_accounts table.
          await fetch("/api/integrations/github/sync", { method: "POST" });
          window.location.reload();
          return;
        }
        console.error(error);
        alert("Failed to connect: " + error.message);
      }
    });
  }

  return (
    <Button onClick={connect} disabled={isPending}>
      {isPending ? "Connecting..." : "Connect GitHub"}
    </Button>
  );
}
