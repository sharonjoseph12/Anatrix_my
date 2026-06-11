"use client";

// T047 — Telegram channel card.
// Flow: user clicks "Connect Telegram" → POST /api/channels/connect returns a
// t.me/<bot>?start=<token> URL → we open it in a new tab. The user taps "Start"
// in Telegram → the bot webhook binds chat_id. We poll for verification.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export type TelegramStatus = {
  connected: boolean;
  verified: boolean;
  handle: string | null;
  disconnectedReason: string | null;
  connectedByInstitution: string | null;
};

export function TelegramCard({ initial }: { initial: TelegramStatus }) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Poll for verification while a deep link is outstanding
  useEffect(() => {
    if (!pendingUrl) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`tg-verify-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "external_channel_handles" },
        (payload) => {
          const row = payload.new as {
            channel?: string;
            verified?: boolean;
            platform_handle?: string | null;
          };
          if (row.channel === "telegram" && row.verified) {
            setStatus({
              connected: true,
              verified: true,
              handle: row.platform_handle ?? null,
              disconnectedReason: null,
              connectedByInstitution: null,
            });
            setPendingUrl(null);
            toast.success("Telegram connected");
            supabase.removeChannel(channel);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingUrl]);

  async function connect() {
    setBusy("connect");
    try {
      const res = await fetch("/api/channels/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "telegram" }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        toast.error(body.error ?? "Failed to start Telegram connect");
        return;
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
      setPendingUrl(body.url);
      toast.message("Open Telegram and tap Start to finish connecting.");
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
        body: JSON.stringify({ channel: "telegram", reason: "user_requested" }),
      });
      if (!res.ok) {
        toast.error("Failed to disconnect");
        return;
      }
      toast.success("Telegram disconnected");
      setStatus({
        connected: false,
        verified: false,
        handle: null,
        disconnectedReason: "user_requested",
        connectedByInstitution: null,
      });
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
              <Send className="h-4 w-4 text-sky-500" />
              Telegram
            </CardTitle>
            <CardDescription>
              Get nudges via Telegram DM. Free for everyone.
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
          ) : pendingUrl ? (
            <Badge variant="secondary">Waiting for /start</Badge>
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
              {status.disconnectedReason && !status.verified && (
                <p className="mt-1 text-xs text-rose-500">Reason: {status.disconnectedReason}</p>
              )}
            </div>
            {status.connectedByInstitution && (
              <Badge variant="secondary" className="text-[10px]">
                Connected by {status.connectedByInstitution}
              </Badge>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={connect} disabled={busy !== null}>
                Reconnect
              </Button>
              <Button size="sm" variant="ghost" onClick={disconnect} disabled={busy !== null}>
                {busy === "disconnect" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
              </Button>
            </div>
          </>
        ) : pendingUrl ? (
          <div className="rounded-md border border-dashed p-3 text-sm">
            <p className="font-medium">Finish in Telegram</p>
            <p className="text-xs text-muted-foreground">
              Tap Start in the chat that just opened. We&apos;ll detect the connection automatically.
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.open(pendingUrl, "_blank", "noopener,noreferrer")}>
                Reopen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(pendingUrl);
                  toast.success("Link copied");
                }}
              >
                <Copy className="h-3 w-3" /> Copy link
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={connect} disabled={busy !== null}>
            {busy === "connect" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect Telegram"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
