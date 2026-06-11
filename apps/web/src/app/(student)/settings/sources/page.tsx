"use client";

// T038 — Source connection management: GitHub / Calendar / WhatsApp.
// Each source shows status, last sync, last error (if any), reconnect/disconnect buttons.

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Github, Calendar, MessageCircle, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type SourceKey = "github" | "calendar" | "whatsapp";
type SourceStatus = "active" | "disconnected" | "expired" | "not_connected";

type Source = {
  key: SourceKey;
  label: string;
  icon: React.ReactNode;
  status: SourceStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  detail: string | null;
};

export function SourcesSettings() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [busy, setBusy] = useState<SourceKey | null>(null);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: gh }, { data: cal }, { data: wa }] = await Promise.all([
      supabase.from("github_accounts").select("username,status,last_synced_at,last_error").eq("user_id", user.id).maybeSingle(),
      supabase.from("calendar_accounts").select("email,status,last_synced_at,last_error").eq("user_id", user.id).maybeSingle(),
      supabase.from("whatsapp_connections").select("phone_number,status,last_delivery_at,last_error").eq("user_id", user.id).maybeSingle(),
    ]);
    setSources([
      {
        key: "github",
        label: "GitHub",
        icon: <Github className="h-4 w-4" />,
        status: (gh?.status as SourceStatus) ?? "not_connected",
        lastSyncAt: gh?.last_synced_at ?? null,
        lastError: gh?.last_error ?? null,
        detail: gh?.username ?? null,
      },
      {
        key: "calendar",
        label: "Google Calendar",
        icon: <Calendar className="h-4 w-4" />,
        status: (cal?.status as SourceStatus) ?? "not_connected",
        lastSyncAt: cal?.last_synced_at ?? null,
        lastError: cal?.last_error ?? null,
        detail: cal?.email ?? null,
      },
      {
        key: "whatsapp",
        label: "WhatsApp",
        icon: <MessageCircle className="h-4 w-4" />,
        status: (wa?.status as SourceStatus) ?? "not_connected",
        lastSyncAt: wa?.last_delivery_at ?? null,
        lastError: wa?.last_error ?? null,
        detail: wa?.phone_number ?? null,
      },
    ]);
  }

  useEffect(() => { load(); }, []);

  async function connect(src: SourceKey) {
    setBusy(src);
    try {
      if (src === "github") {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` } });
      } else if (src === "calendar") {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard`, scopes: "https://www.googleapis.com/auth/calendar.readonly" } });
      } else {
        const r = await fetch("/functions/v1/whatsapp-connect", { method: "POST" });
        if (r.ok) {
          const j = await r.json() as { deep_link: string };
          window.open(j.deep_link, "_blank", "noopener,noreferrer");
        }
      }
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(src: SourceKey) {
    setBusy(src);
    try {
      await fetch(`/functions/v1/sources-disconnect/${src}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!sources) return <div className="h-32 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="space-y-4">
      {sources.map((s) => (
        <Card key={s.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {s.icon}{s.label}
              <StatusBadge status={s.status} />
            </CardTitle>
            <CardDescription>
              {s.detail ?? "Not connected"}
              {s.lastSyncAt && <> · last activity {timeAgo(s.lastSyncAt)}</>}
            </CardDescription>
          </CardHeader>
          {s.lastError && (
            <CardContent>
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-medium">Last error</p>
                  <p className="text-xs opacity-80">{s.lastError}</p>
                </div>
              </div>
            </CardContent>
          )}
          <CardContent className="flex gap-2">
            {s.status === "active" ? (
              <Button variant="outline" size="sm" onClick={() => disconnect(s.key)} disabled={busy === s.key}>
                {busy === s.key ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
              </Button>
            ) : (
              <Button size="sm" onClick={() => connect(s.key)} disabled={busy === s.key}>
                {busy === s.key ? <Loader2 className="h-3 w-3 animate-spin" /> : s.status === "not_connected" ? "Connect" : "Reconnect"}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: SourceStatus }) {
  const map: Record<SourceStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    active: { variant: "secondary", label: "Active" },
    not_connected: { variant: "outline", label: "Not connected" },
    disconnected: { variant: "outline", label: "Disconnected" },
    expired: { variant: "destructive", label: "Expired" },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Connected sources</h1>
      <p className="text-sm text-muted-foreground">
        Your data sources for passive tracking and the AI Coach.
        Disconnecting stops future syncs but never deletes your past data.
      </p>
      <SourcesSettings />
    </div>
  );
}
