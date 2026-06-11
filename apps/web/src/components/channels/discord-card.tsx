"use client";

// T046 — Discord channel card.
// States: not_connected → Connect (OAuth redirect) | pending_dm → "finish in Discord" |
// connected → handle + last verified + Verify / Disconnect | reconnect → re-authorise.

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export type DiscordStatus = {
  connected: boolean;
  verified: boolean;
  handle: string | null;
  disconnectedReason: string | null;
  lastVerifiedAt: string | null;
  connectedByInstitution: string | null;
};

export function DiscordCard({
  initial,
  onChange,
}: {
  initial: DiscordStatus;
  onChange?: () => void;
}) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState<"connect" | "verify" | "disconnect" | null>(null);

  async function connect() {
    setBusy("connect");
    try {
      const res = await fetch("/api/channels/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "discord" }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        toast.error(body.error ?? "Failed to start Discord connect");
        return;
      }
      window.location.href = body.url;
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
    try {
      const res = await fetch("/api/channels/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "discord" }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? "Test message failed — try reconnecting");
        setStatus((s) => ({ ...s, verified: false }));
        onChange?.();
        return;
      }
      toast.success("Test message sent to Discord");
      setStatus((s) => ({ ...s, verified: true, lastVerifiedAt: new Date().toISOString() }));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      const res = await fetch("/api/channels/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "discord", reason: "user_requested" }),
      });
      if (!res.ok) {
        toast.error("Failed to disconnect");
        return;
      }
      toast.success("Discord disconnected");
      setStatus({
        connected: false,
        verified: false,
        handle: null,
        disconnectedReason: "user_requested",
        lastVerifiedAt: null,
        connectedByInstitution: null,
      });
      onChange?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              Discord
            </CardTitle>
            <CardDescription>
              Get AI Coach nudges as a DM in Discord. Free for everyone.
            </CardDescription>
          </div>
          {status.connected && status.verified ? (
            <Badge variant="default" className="bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
            </Badge>
          ) : status.connected ? (
            <Badge variant="secondary">
              <AlertCircle className="mr-1 h-3 w-3" /> Needs reconnect
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.connected ? (
          <>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Connected as</p>
              <p className="font-mono">@{status.handle ?? "—"}</p>
              {status.lastVerifiedAt && (
                <p className="text-xs text-muted-foreground">
                  Last test: {new Date(status.lastVerifiedAt).toLocaleString()}
                </p>
              )}
              {status.disconnectedReason && !status.verified && (
                <p className="mt-1 text-xs text-rose-500">
                  Reason: {status.disconnectedReason}
                </p>
              )}
            </div>
            {status.connectedByInstitution && (
              <Badge variant="secondary" className="text-[10px]">
                Connected by {status.connectedByInstitution}
              </Badge>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={verify} disabled={busy !== null}>
                {busy === "verify" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send test"}
              </Button>
              <Button size="sm" variant="ghost" onClick={disconnect} disabled={busy !== null}>
                {busy === "disconnect" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
              </Button>
              <Button size="sm" variant="link" onClick={connect} disabled={busy !== null}>
                <ExternalLink className="h-3 w-3" /> Reconnect
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={connect} disabled={busy !== null}>
            {busy === "connect" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect Discord"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
