"use client";

// T032 — Connect WhatsApp affordance on the dashboard.
// Calls POST /functions/v1/whatsapp-connect (or the Next.js route shim) and shows the wa.me deep link.

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, Loader2 } from "lucide-react";

type Props = { initialOptedIn: boolean };

export function ConnectWhatsAppCard({ initialOptedIn }: Props) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startConnect() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/functions/v1/whatsapp-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const json = (await resp.json()) as { deep_link: string };
      setLink(json.deep_link);
      window.open(json.deep_link, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start WhatsApp connect");
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/functions/v1/whatsapp-connect", { method: "DELETE" });
      if (!resp.ok && resp.status !== 204) throw new Error(await resp.text());
      setOptedIn(false);
      setLink(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect WhatsApp");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Get daily coaching on WhatsApp
        </CardTitle>
        <CardDescription>
          Your AI Coach sends a morning plan, real-time nudges, and a weekly summary.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {optedIn ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              WhatsApp connected. Daily morning nudges at 8 AM.
            </p>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
            </Button>
          </div>
        ) : link ? (
          <div className="space-y-2">
            <p className="text-sm">Open this link in WhatsApp to finish connecting:</p>
            <a href={link} className="break-all text-sm text-primary underline" target="_blank" rel="noreferrer">
              {link}
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            <Button onClick={startConnect} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect WhatsApp"}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
