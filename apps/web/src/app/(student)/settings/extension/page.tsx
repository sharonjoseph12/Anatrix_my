"use client";

// Power Mode extension status: shows install state, current version, last heartbeat,
// and a "Re-install" CTA. Backed by extension_telemetry + v_power_mode_status.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ExternalLink } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const STORE_URL = process.env.NEXT_PUBLIC_POWER_MODE_STORE_URL ?? "https://chromewebstore.google.com/category/extensions";

export function ExtensionStatus() {
  const [status, setStatus] = useState<{ active: boolean; version: string | null; last: string | null } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: view } = await supabase.from("v_power_mode_status")
        .select("power_mode_active,last_heartbeat_at").eq("user_id", user.id).maybeSingle();
      const { data: last } = await supabase.from("extension_telemetry")
        .select("extension_version,browser,last_heartbeat_at")
        .eq("user_id", user.id).order("last_heartbeat_at", { ascending: false }).limit(1).maybeSingle();
      setStatus({
        active: !!view?.power_mode_active,
        version: last?.extension_version ?? null,
        last: view?.last_heartbeat_at ?? last?.last_heartbeat_at ?? null,
      });
    })();
  }, []);

  if (!status) return <div className="h-32 animate-pulse rounded-md bg-muted" />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4" /> Power Mode extension
        </CardTitle>
        {status.active ? <Badge>Active</Badge> : <Badge variant="outline">Not installed</Badge>}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Version</span>
          <span className="font-mono">{status.version ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last heartbeat</span>
          <span>{status.last ? new Date(status.last).toLocaleString() : "—"}</span>
        </div>
        <Button asChild variant={status.active ? "outline" : "default"} className="w-full">
          <a href={STORE_URL} target="_blank" rel="noreferrer noopener">
            <ExternalLink className="mr-1 h-3 w-3" />
            {status.active ? "Re-install" : "Install Power Mode"}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
