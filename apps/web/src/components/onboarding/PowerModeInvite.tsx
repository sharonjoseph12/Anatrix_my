"use client";

// T031 — Power Mode invite card shown on the student dashboard until telemetry
// confirms install. Switches to "Power Mode Active" once the badge becomes active.

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Props = {
  initialActive: boolean;
};

export function PowerModeInvite({ initialActive }: Props) {
  const [active, setActive] = useState(initialActive);
  const [installUrl, setInstallUrl] = useState(
    "https://chrome.google.com/webstore/detail/antarix-power-mode",
  );

  useEffect(() => {
    if (active) return;
    const supabase = createSupabaseBrowserClient();
    const id = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("power_mode_active,power_mode_badge_shown_at")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.power_mode_active) setActive(true);
    }, 30_000);
    return () => clearInterval(id);
  }, [active]);

  if (active) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Power Mode active
            <Badge variant="secondary" className="ml-2">⚡</Badge>
          </CardTitle>
          <CardDescription>
            <CheckCircle2 className="mr-1 inline h-3 w-3" />
            Your sessions are tracked at category + focus-quality granularity.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Want 10× richer insights?
        </CardTitle>
        <CardDescription>
          Install the Antarix Power Mode Chrome extension to unlock session-level
          focus tracking, real-time peak detection, and a ⚡ badge on your profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href={installUrl} target="_blank" rel="noreferrer">Install Power Mode</a>
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Optional. Without it, all of your passive insights still work.
        </p>
      </CardContent>
    </Card>
  );
}
