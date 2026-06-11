"use client";

// T068 — Credential management: public URL, copy, snapshot details, distribution
// affordances (PDF / QR / LinkedIn).

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, QrCode, Linkedin, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Cred = {
  public_slug: string;
  overall_score: number;
  per_skill: Record<string, number>;
  cohort_percentile: number | null;
  snapshot_taken_at: string;
  revocation_status: string;
  verification_count: number;
};

export function CredentialManager() {
  const [cred, setCred] = useState<Cred | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("verifiable_credentials")
      .select("public_slug,snapshot_overall_score,snapshot_per_skill,snapshot_cohort_percentile,snapshot_taken_at,revocation_status,verification_count")
      .eq("user_id", user.id).eq("revocation_status", "active")
      .order("snapshot_taken_at", { ascending: false }).limit(1).maybeSingle();
    if (data) {
      setCred({
        public_slug: data.public_slug,
        overall_score: data.snapshot_overall_score,
        per_skill: (data.snapshot_per_skill as Record<string, number>) ?? {},
        cohort_percentile: data.snapshot_cohort_percentile,
        snapshot_taken_at: data.snapshot_taken_at,
        revocation_status: data.revocation_status,
        verification_count: data.verification_count ?? 0,
      });
    }
  }

  useEffect(() => { load(); }, []);

  const publicUrl = cred ? `${location.origin}/verify/${cred.public_slug}` : "";

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function distribute(channel: "pdf" | "qr" | "linkedin") {
    if (!cred) return;
    setBusy(channel);
    try {
      const supabase = createSupabaseBrowserClient();
      const r = await supabase.functions.invoke("credential-distribute", { body: { channel, slug: cred.public_slug } });
      if (r.data && typeof r.data === "object" && "url" in r.data && channel !== "linkedin") {
        window.open((r.data as { url: string }).url, "_blank", "noopener,noreferrer");
      }
    } finally { setBusy(null); }
  }

  if (!cred) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Credential</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You don&apos;t have a credential yet. It will be issued automatically once your Skill Proof Score has enough signal.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Verified credential
          <Badge variant="secondary">{cred.revocation_status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
          {publicUrl}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy link
          </Button>
          <Button size="sm" variant="outline" onClick={() => distribute("pdf")} disabled={busy === "pdf"}>
            {busy === "pdf" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => distribute("qr")} disabled={busy === "qr"}>
            {busy === "qr" ? <Loader2 className="h-3 w-3 animate-spin" /> : <QrCode className="h-3 w-3" />} QR
          </Button>
          <Button size="sm" variant="outline" onClick={() => distribute("linkedin")} disabled={busy === "linkedin"}>
            {busy === "linkedin" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Linkedin className="h-3 w-3" />} LinkedIn
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={publicUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="h-3 w-3" /> Open
            </a>
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-muted-foreground">Score</dt><dd className="text-lg font-semibold tabular-nums">{cred.overall_score}</dd></div>
          <div><dt className="text-muted-foreground">Percentile</dt><dd className="text-lg font-semibold tabular-nums">{cred.cohort_percentile ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Snapshot</dt><dd>{new Date(cred.snapshot_taken_at).toLocaleDateString()}</dd></div>
          <div><dt className="text-muted-foreground">Verifications</dt><dd className="text-lg font-semibold tabular-nums">{cred.verification_count}</dd></div>
        </dl>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Verified credential</h1>
      <p className="text-sm text-muted-foreground">A public, signed URL that proves your Skill Proof Score at a moment in time. Recruiters and friends can verify without an account.</p>
      <CredentialManager />
    </div>
  );
}
