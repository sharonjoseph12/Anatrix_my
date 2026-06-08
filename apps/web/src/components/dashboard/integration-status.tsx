"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Github, CalendarDays, RefreshCw, Unplug, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Integration = {
  provider: "github" | "google_calendar";
  status: "active" | "disconnected" | "expired" | "not_connected";
  username?: string | null;
  email?: string | null;
  last_synced_at?: string | null;
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

const STATUS_LABELS: Record<Integration["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Connected", variant: "default" },
  expired: { label: "Reconnect required", variant: "destructive" },
  disconnected: { label: "Disconnected", variant: "outline" },
  not_connected: { label: "Not connected", variant: "outline" },
};

export function IntegrationStatus({
  integrations,
  onSync,
}: {
  integrations: Integration[];
  onSync?: (provider: Integration["provider"]) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Background jobs keep your skill profile accurate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {integrations.map((i) => (
          <IntegrationRow key={i.provider} integration={i} onSync={onSync} />
        ))}
      </CardContent>
    </Card>
  );
}

function IntegrationRow({
  integration,
  onSync,
}: {
  integration: Integration;
  onSync?: (provider: Integration["provider"]) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const Icon = integration.provider === "github" ? Github : CalendarDays;
  const isGitHub = integration.provider === "github";
  const status = STATUS_LABELS[integration.status];

  const handleSync = () => {
    if (!onSync) return;
    startTransition(async () => {
      setSyncing(true);
      try {
        await onSync(integration.provider);
      } finally {
        setSyncing(false);
      }
    });
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border p-3",
        integration.status === "expired" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border bg-background",
            integration.status === "active" && "text-foreground",
            integration.status !== "active" && "text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              {isGitHub ? "GitHub" : "Google Calendar"}
            </p>
            <Badge variant={status.variant} className="h-5 px-2 text-[10px]">
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {integration.status === "active"
              ? `${integration.username ?? integration.email ?? "—"} · last sync ${timeAgo(integration.last_synced_at)}`
              : isGitHub
                ? "Connect to surface commit activity and language stats."
                : "Connect to surface focus blocks and meetings."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {integration.status === "active" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={syncing || isPending}
            >
              {syncing || isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span className="ml-1">Sync</span>
            </Button>
            <form action="/api/integrations/disconnect" method="post">
              <input type="hidden" name="provider" value={integration.provider} />
              <Button size="sm" variant="ghost" type="submit">
                <Unplug className="h-3 w-3" />
              </Button>
            </form>
          </>
        ) : (
          <Button size="sm" asChild>
            <Link
              href={
                isGitHub
                  ? "/api/integrations/github/connect"
                  : "/api/integrations/calendar/connect"
              }
            >
              Connect
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
