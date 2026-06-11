"use client";

// T040 — Non-blocking sync health banner shown on the dashboard when any
// source has a recent last_error.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Issue = { source: string; error: string };

export function SyncHealthBanner() {
  const [issues, setIssues] = useState<Issue[] | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: gh }, { data: cal }, { data: wa }] = await Promise.all([
        supabase.from("github_accounts").select("last_error,last_error_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("calendar_accounts").select("last_error,last_error_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("whatsapp_connections").select("last_error,last_error_at").eq("user_id", user.id).maybeSingle(),
      ]);
      const out: Issue[] = [];
      for (const [src, row] of [["GitHub", gh], ["Calendar", cal], ["WhatsApp", wa]] as const) {
        if (row?.last_error && row.last_error_at) {
          // only show errors from the last 7 days
          const ageMs = Date.now() - new Date(row.last_error_at).getTime();
          if (ageMs < 7 * 24 * 3600 * 1000) out.push({ source: src, error: row.last_error });
        }
      }
      if (!cancelled) setIssues(out);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!issues || issues.length === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
      <div className="flex-1">
        <p className="font-medium">Some sources are having trouble</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {issues.map((i) => (
            <li key={i.source}><b>{i.source}:</b> {i.error}</li>
          ))}
        </ul>
        <Link href="/settings/sources" className="mt-2 inline-block text-xs font-medium text-amber-700 underline">
          Reconnect in settings →
        </Link>
      </div>
    </div>
  );
}
