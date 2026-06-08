"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Bell, Briefcase, CalendarCheck, Sparkles, TrendingUp, Users, Code2, Send, MessageSquare, GraduationCap, Link2, Flame } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  insight_ready: TrendingUp as unknown as React.ComponentType<{ className?: string }>,
  company_interest: Briefcase as unknown as React.ComponentType<{ className?: string }>,
  interview_scheduled: CalendarCheck as unknown as React.ComponentType<{ className?: string }>,
  hiring_outcome: Sparkles as unknown as React.ComponentType<{ className?: string }>,
  cohort_invite: Users as unknown as React.ComponentType<{ className?: string }>,
  // 003 additions
  dsa_synced: Code2 as unknown as React.ComponentType<{ className?: string }>,
  dsa_sync_failed: Code2 as unknown as React.ComponentType<{ className?: string }>,
  public_profile_viewed: Link2 as unknown as React.ComponentType<{ className?: string }>,
  public_profile_milestone: Sparkles as unknown as React.ComponentType<{ className?: string }>,
  channel_connected: MessageSquare as unknown as React.ComponentType<{ className?: string }>,
  channel_disconnected: MessageSquare as unknown as React.ComponentType<{ className?: string }>,
  channel_test_delivered: Send as unknown as React.ComponentType<{ className?: string }>,
  institution_bulk_nudge: GraduationCap as unknown as React.ComponentType<{ className?: string }>,
  streak_risk: Flame as unknown as React.ComponentType<{ className?: string }>,
  default: Bell as unknown as React.ComponentType<{ className?: string }>,
};

export function NotificationHost() {
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const n = payload.new as NotificationRow;
            if (seenIds.current.has(n.id)) return;
            seenIds.current.add(n.id);
            const Icon = ICONS[n.kind] ?? ICONS.default ?? Bell;
            toast(n.title, {
              description: n.body ?? undefined,
              icon: <Icon className="h-4 w-4" />,
              action: n.href
                ? {
                    label: "View",
                    onClick: () => {
                      window.location.href = n.href!;
                    },
                  }
                : undefined,
            });
          },
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
