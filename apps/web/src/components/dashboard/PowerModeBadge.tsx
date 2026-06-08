"use client";

// T057 + T060 — Power Mode badge in the dashboard header. When telemetry shows a
// fresh heartbeat (within NUDGE_POWER_MODE_BADGE_FRESHNESS_HOURS) the user is
// in "Active" state; otherwise we show the invite card.

import { useEffect, useState } from "react";
import { Zap, ZapOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { PowerModeInvite } from "@/components/onboarding/PowerModeInvite";

export function PowerModeBadge() {
  const [active, setActive] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("v_power_mode_status")
        .select("power_mode_active,last_heartbeat_at").eq("user_id", user.id).maybeSingle();
      if (!cancelled) setActive(!!data?.power_mode_active);
    }
    check();
    const i = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(i); };
  }, []);

  if (active === null) return null;
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600" aria-label="Power Mode active">
        <Zap className="h-3 w-3" /> Power Mode
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground" aria-label="Power Mode not active">
      <ZapOff className="h-3 w-3" /> Power Mode off
    </span>
  );
}

// Convenience: full invite state when the extension isn't running
export function PowerModeStatus() {
  return <PowerModeInvite initialActive={false} />;
}
