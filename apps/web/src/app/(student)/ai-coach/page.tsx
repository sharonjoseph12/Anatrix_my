"use client";

// T048 — AI Coach inbox. Paginated list of nudges, per-row delivery status,
// click-through targets, command-reply box for web parity with WhatsApp.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Bell } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { toLocalIsoString } from "@/lib/timezone";

type Nudge = {
  id: string;
  type: string;
  template_id: string;
  rendered_body: string;
  delivery_status: string;
  created_at: string;
  personalization_context: Record<string, unknown> | null;
};

const PAGE_SIZE = 20;

export function NudgeInbox() {
  const [items, setItems] = useState<Nudge[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [tz, setTz] = useState<string>("UTC");

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    load(0);
  }, []);

  async function load(offset: number) {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("nudges").select("id,type,template_id,rendered_body,delivery_status,created_at,personalization_context")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE);
    if (!data) return;
    if (offset === 0) setItems(data); else setItems((prev) => [...(prev ?? []), ...data]);
    setHasMore(data.length === PAGE_SIZE + 1);
  }

  async function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const cmd = reply.trim().toUpperCase().split(/\s+/)[0] ?? "";
    const validCmds = ["START", "DONE", "STATS", "RANK", "HELP", "PAUSE", "RESUME"] as const;
    if (cmd && (validCmds as readonly string[]).includes(cmd)) {
      const { data: latest } = await supabase.from("nudges").select("id")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      await supabase.from("nudge_responses").insert({
        nudge_id: latest?.id ?? "00000000-0000-0000-0000-000000000000",
        user_id: user.id,
        channel: "web",
        response_kind: "command",
        command: cmd as typeof validCmds[number],
        raw_text: reply,
      });
    }
    setReply("");
    setSending(false);
    load(0);
  }

  if (!items) return <div className="h-32 animate-pulse rounded-md bg-muted" />;
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Bell className="mx-auto mb-2 h-6 w-6 opacity-50" />
        No nudges yet. Once your AI Coach activates (after Day-1), you&apos;ll see daily morning and streak-risk nudges here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((n) => (
        <Card key={n.id} className="transition-colors hover:bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TypeIcon type={n.type} />
              <span>{humanType(n.type)}</span>
              <StatusBadge status={n.delivery_status} />
            </CardTitle>
            <p className="text-xs text-muted-foreground">{toLocalIsoString(n.created_at, { timeZone: tz })}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{n.rendered_body}</p>
          </CardContent>
        </Card>
      ))}
      {hasMore && <Button variant="outline" className="w-full" onClick={() => load(items.length)}>Load more</Button>}
      <form onSubmit={sendCommand} className="flex gap-2 pt-2">
        <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply with a command (STATS, RANK, PAUSE, …)" />
        <Button type="submit" disabled={sending}>
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant: "default" | "secondary" | "destructive" | "outline" =
    status === "delivered" ? "secondary" : status === "failed" ? "destructive" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function humanType(t: string): string {
  if (t.startsWith("reply_")) return `Reply: ${t.slice(6).toUpperCase()}`;
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function TypeIcon({ type }: { type: string }) {
  const map: Record<string, string> = {
    daily_morning: "☀", real_time_peak: "⚡", streak_risk: "🔥", weekly_summary: "📊",
  };
  return <span className="text-base">{map[type] ?? "✦"}</span>;
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">AI Coach inbox</h1>
      <p className="text-sm text-muted-foreground">
        Your nudges, delivery status, and the same command set your WhatsApp coach understands.
      </p>
      <NudgeInbox />
    </div>
  );
}
