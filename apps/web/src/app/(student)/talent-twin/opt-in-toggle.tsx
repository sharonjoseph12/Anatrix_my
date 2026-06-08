"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function OptInToggle({ initialOptIn }: { initialOptIn: boolean }) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/talent-twin-opt-in`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${(await fetch("/api/auth/token").then((r) => r.json())).token}`,
            },
            body: JSON.stringify({ opt_in: !optIn }),
          },
        );
        const data = await res.json();
        if (res.ok) {
          setOptIn(data.opt_in);
          setMessage(data.message);
        } else {
          setMessage(data.error?.message ?? "Failed to toggle");
        }
      } catch {
        setMessage("Network error");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={toggle} disabled={isPending} variant={optIn ? "outline" : "default"}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {optIn ? "Disable Talent Twin" : "Enable Talent Twin"}
      </Button>
      {message && <p className="text-xs text-muted-foreground max-w-xs text-right">{message}</p>}
    </div>
  );
}
