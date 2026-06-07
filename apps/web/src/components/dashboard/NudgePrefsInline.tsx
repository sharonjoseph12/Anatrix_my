"use client";

// T099 — Inline "Mute for today" / "Pause all" controls surfacing in every
// nudge inbox item (per FR-020's single pause-all control requirement).

import { useState } from "react";
import { BellOff, Pause, Play } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function NudgePrefsInline({ nudgeId }: { nudgeId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "muted" | "paused">(null);

  async function muteToday() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await supabase.from("nudge_preferences").update({ mute_until: until }).eq("user_id", user.id);
    // Mark this nudge as handled so it stops re-rendering
    await supabase.from("nudges").update({ delivery_status: "muted" }).eq("id", nudgeId);
    setBusy(false); setDone("muted");
  }

  async function pauseAll() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("nudge_preferences").update({ pause_all: true }).eq("user_id", user.id);
    setBusy(false); setDone("paused");
  }

  if (done === "muted") return <span className="text-xs text-muted-foreground">Muted for 24h ✓</span>;
  if (done === "paused") return <span className="text-xs text-muted-foreground">All nudges paused ✓</span>;

  return (
    <div className="flex items-center gap-1">
      <button onClick={muteToday} disabled={busy} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted">
        <BellOff className="h-3 w-3" /> Mute for today
      </button>
      <button onClick={pauseAll} disabled={busy} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted">
        <Pause className="h-3 w-3" /> Pause all
      </button>
    </div>
  );
}
