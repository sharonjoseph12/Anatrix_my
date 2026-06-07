"use client";

// T059 — Per-session timeline shown on the student dashboard when Power Mode is
// active. Extends the 001 session view with category, duration, focus quality,
// and self-rating.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Session = {
  id: string;
  category: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  focus_quality_score: number | null;
  self_rating: number | null;
  is_ad_hoc: boolean | null;
};

export function PowerSessionsTimeline() {
  const [items, setItems] = useState<Session[] | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("sessions")
        .select("id,category,started_at,ended_at,duration_minutes,focus_quality_score,self_rating,is_ad_hoc")
        .eq("user_id", user.id)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(20);
      setItems((data as Session[]) ?? []);
    })();
  }, []);

  if (!items) return <div className="h-32 animate-pulse rounded-md bg-muted" />;
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">No Power Mode sessions yet</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Install the Power Mode Chrome extension to start tracking focused sessions automatically.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((s) => (
        <Card key={s.id}>
          <CardContent className="flex items-center justify-between py-3 text-sm">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{s.category}</Badge>
              <div>
                <p className="font-medium">{new Date(s.started_at).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {s.duration_minutes ?? "–"} min{s.is_ad_hoc ? " · ad-hoc" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {s.focus_quality_score != null && <Badge>Focus {Math.round(s.focus_quality_score)}</Badge>}
              {s.self_rating != null && <Badge variant="outline">★ {s.self_rating}/5</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Power Mode sessions</h1>
      <PowerSessionsTimeline />
    </div>
  );
}
