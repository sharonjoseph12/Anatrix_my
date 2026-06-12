"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function ExtensionAuthPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Connecting extension…");

  useEffect(() => {
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace("/login?next=/extension/auth&extension=1");
        return;
      }

      window.postMessage(
        {
          type: "antarix:auth-handoff",
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          apiBase: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        },
        window.location.origin,
      );

      setStatus("ok");
      setMessage("Extension connected. You can close this tab and reopen the Antarix popup.");
    })();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Power Mode extension</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      {status === "ok" ? (
        <Button asChild variant="outline">
          <Link href="/settings/sources">Manage connected sources</Link>
        </Button>
      ) : null}
    </main>
  );
}
