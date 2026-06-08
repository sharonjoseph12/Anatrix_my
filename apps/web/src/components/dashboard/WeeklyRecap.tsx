"use client";

// A small "what changed" panel that shows the last 7 days of nudges, score
// changes, and credential events. Backed by existing tables only.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Zap, Award, TrendingUp, Bell } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Event = { id: string; kind: "nudge" | "score" | "credential"; label: string; at: string; meta?: string };

const ICONS = { nudge: Bell, score: TrendingUp, credential: Award } as const;

export function WeeklyRecap() {
  const [items, setItems] = useState<Event[] | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [{ data: nudges }, { data: creds }] = await Promise.all([
        supabase.from("nudges").select("id,type,created_at").eq("user_id", user.id).gte("created_at", since).order("created_at", { ascending: false }).limit(20),
        supabase.from("verifiable_credentials").select("id,snapshot_taken_at").eq("user_id", user.id).gte("snapshot_taken_at", since).order("snapshot_taken_at", { ascending: false }),
      ]);
      const events: Event[] = [];
      for (const n of nudges ?? []) events.push({ id: n.id, kind: "nudge", label: n.type, at: n.created_at });
      for (const c of creds ?? []) events.push({ id: c.id, kind: "credential", label: "Credential snapshot", at: c.snapshot_taken_at });
      events.sort((a, b) => b.at.localeCompare(a.at));
      setItems(events.slice(0, 10));
    })();
  }, []);

  if (!items) return <div className="h-32 animate-pulse rounded-md bg-muted" />;
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">This week</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">No activity in the last 7 days yet.</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">This week</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.map((e) => {
          const Icon = ICONS[e.kind];
          return (
            <div key={e.id + e.at} className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Icon className="h-3 w-3" />{e.label}</span>
              <span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleDateString()}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
