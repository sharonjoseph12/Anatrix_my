"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Power, Unplug, CircleAlert, ShieldOff } from "lucide-react";
import type { SignalSource } from "@antarix/types/signals";
import { WhatWeLearned } from "./what-we-learned";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  connected: "success",
  disconnected: "outline",
  expired: "destructive",
};

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatPeriod(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    if (y && m && d) {
      try {
        return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
      } catch {
        return s.slice(0, 10);
      }
    }
  }
  return s;
}

export function SourceCard({ source, onDisconnect }: { source: SignalSource; onDisconnect?: () => void }) {
  const t = useTranslations("settings.signals");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const locale = typeof document !== "undefined" ? document.documentElement.lang || "en" : "en";

  const isActive = source.status === "connected";
  const isExpired = source.status === "expired";

  async function handleDisconnect() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/signals/${encodeURIComponent(source.provider)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
        const msg = typeof body.error === "string" ? body.error : body.error?.message;
        toast.error(msg ?? t("delete_all.error"));
        return;
      }
      toast.success(t("disconnect"));
      if (onDisconnect) onDisconnect();
      else startTransition(() => router.refresh());
    } catch {
      toast.error(t("delete_all.error"));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = isExpired ? t("expired") : isActive ? t("active") : t("disconnected");
  const statusVariant = STATUS_VARIANT[source.status] ?? "outline";
  const capLabel = t("score_cap", { pct: source.total_score_cap_pct });
  const aggregates = (source.last_5_aggregates ?? []).slice(0, 5);
  const periodHeader = t("recent_aggregates", { n: aggregates.length });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {isActive ? <Power className="h-4 w-4 text-emerald-600" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
              {t(`providers.${source.provider}`)}
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {source.connected_at
                ? t("connected_since", { date: formatDate(source.connected_at, locale) })
                : null}
              {source.connected_at && source.last_sync_at ? " · " : null}
              {source.last_sync_at
                ? t("last_sync", { date: formatDate(source.last_sync_at, locale) })
                : null}
              {" · "}
              {capLabel}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={isActive ? "outline" : "default"}
            size="sm"
            onClick={handleDisconnect}
            disabled={busy}
            aria-pressed={isActive}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isActive ? (
              <>
                <Unplug className="h-3 w-3" />
                {t("disconnect")}
              </>
            ) : isExpired ? (
              t("enable")
            ) : (
              t("enable")
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("what_we_learned")}
          </p>
          <WhatWeLearned text={source.what_we_learned} />
        </div>
        {aggregates.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {periodHeader}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8">Period</TableHead>
                  <TableHead className="h-8">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregates.map((a, i) => {
                  const pct = typeof a.score_contribution === "number" ? a.score_contribution : null;
                  return (
                    <TableRow key={`${a.period_start}-${i}`}>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {formatPeriod(a.period_start, locale)}
                      </TableCell>
                      <TableCell className="py-2 text-xs font-mono">
                        {pct !== null ? t("score_contribution", { pct: Number(pct).toFixed(1) }) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : !isActive ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleAlert className="h-3.5 w-3.5" />
            {t("disconnected")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default SourceCard;
