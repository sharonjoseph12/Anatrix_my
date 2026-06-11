"use client";

// T075 — Public verification page (no auth). Renders HTML returned by
// /functions/v1/credential-public/{slug} via the page's RSC fetch.

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldX, ExternalLink } from "lucide-react";

type Payload = {
  student: { name: string; avatar: string | null };
  overall_score: number;
  per_skill: Record<string, number>;
  verified_activity: Record<string, unknown>;
  cohort_percentile: number | null;
  snapshot_taken_at: string;
  current_score_delta: number;
  revocation_status: "active" | "revoked";
  verification_count: number;
  last_verified_at: string;
};

export default function VerifyPage({ params }: { params: { slug: string } }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/functions/v1/credential-public/${params.slug}`, { headers: { Accept: "application/json" } })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? "not found"); return r.json() as Promise<Payload>; })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [params.slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldX className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Credential not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-md py-16 text-center text-muted-foreground">Loading…</div>;

  const revoked = data.revocation_status !== "active";

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {data.student.avatar
                ? <img src={data.student.avatar} alt="" className="h-12 w-12 rounded-full" />
                : <div className="h-12 w-12 rounded-full bg-muted" />}
              <div>
                <p className="font-semibold">{data.student.name}</p>
                <p className="text-xs text-muted-foreground">Antarix verified credential</p>
              </div>
            </div>
            {revoked ? <Badge variant="destructive">Revoked</Badge> : <Badge className="bg-emerald-500"><ShieldCheck className="mr-1 h-3 w-3" />Active</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Skill Proof Score</dt><dd className="text-2xl font-bold tabular-nums">{data.overall_score}</dd></div>
            <div><dt className="text-muted-foreground">Cohort percentile</dt><dd className="text-2xl font-bold tabular-nums">{data.cohort_percentile ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Snapshot taken</dt><dd>{new Date(data.snapshot_taken_at).toLocaleDateString()}</dd></div>
            <div><dt className="text-muted-foreground">Current delta</dt><dd className="text-lg font-semibold tabular-nums">{data.current_score_delta >= 0 ? "+" : ""}{data.current_score_delta}</dd></div>
            <div><dt className="text-muted-foreground">Verifications</dt><dd className="text-lg font-semibold tabular-nums">{data.verification_count}</dd></div>
            <div><dt className="text-muted-foreground">Last verified</dt><dd>{new Date(data.last_verified_at).toLocaleString()}</dd></div>
          </div>
          <a href={`/verify/${params.slug}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline">
            <ExternalLink className="h-3 w-3" /> Permalink
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
