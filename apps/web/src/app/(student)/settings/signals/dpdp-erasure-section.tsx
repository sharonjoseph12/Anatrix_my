"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, CheckCircle2, Clock, AlertCircle, Send } from "lucide-react";
import type { DPDPErasureRequest } from "@/lib/audit/dpdp-erasure";

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(iso).slice(0, 10);
  }
}

function statusBadge(status: DPDPErasureRequest["status"], t: (k: "pending" | "in_progress" | "complete", v?: Record<string, string>) => string, due: string, completed: string | null, locale: string) {
  if (status === "complete") {
    return <Badge variant="success">{t("complete", { date: formatDate(completed, locale) })}</Badge>;
  }
  if (status === "in_progress") {
    return <Badge variant="warning"><Clock className="mr-1 inline h-3 w-3" />{t("in_progress")}</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive"><AlertCircle className="mr-1 inline h-3 w-3" />Failed</Badge>;
  }
  return <Badge variant="outline">{t("pending", { date: formatDate(due, locale) })}</Badge>;
}

export function DPDPErasureSection({ requests }: { requests: DPDPErasureRequest[] }) {
  const t = useTranslations("settings.signals");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const locale = typeof document !== "undefined" ? document.documentElement.lang || "en" : "en";

  const hasOpen = requests.some((r) => r.status === "pending" || r.status === "in_progress");

  async function requestErasure() {
    if (busy || hasOpen) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/signals/dpdp-erasure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
        const msg = typeof body.error === "string" ? body.error : body.error?.message;
        toast.error(msg ?? t("delete_all.error"));
        return;
      }
      toast.success(t("delete_all.success"));
      router.refresh();
    } catch {
      toast.error(t("delete_all.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          {t("dpdp_erasure.title")}
        </CardTitle>
        <CardDescription>{t("dpdp_erasure.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDate(r.requested_at, locale)}
                  </p>
                  <div className="mt-0.5">
                    {statusBadge(r.status, t, r.due_by, r.completed_at, locale)}
                  </div>
                </div>
                {r.completed_at ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant={hasOpen ? "outline" : "default"}
          size="sm"
          onClick={requestErasure}
          disabled={busy || hasOpen}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          {t("dpdp_erasure.request_button")}
        </Button>
      </CardContent>
    </Card>
  );
}

export default DPDPErasureSection;
