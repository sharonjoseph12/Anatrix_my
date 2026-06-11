"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function MatchButton({
  companyId,
  companyName,
  institutionId,
}: {
  companyId: string;
  companyName: string;
  institutionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/institutions/auto-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, institution_id: institutionId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Match failed");
        return;
      }
      const data = (await res.json()) as { matched: number; total: number };
      toast.success(
        `Matched ${data.matched} of ${data.total} placement-ready students to ${companyName}`,
      );
      startTransition(() => location.reload());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={busy || isPending}>
      {busy || isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      <span className="ml-1">Auto-match</span>
    </Button>
  );
}

interface MatchedStudent {
  user_id: string;
  display_name: string | null;
  email: string;
  match_score: number;
  primary_specialization: string | null;
}

function MatchResultCard({
  result,
  onClose,
}: {
  result: { companyName: string; students: MatchedStudent[] } | null;
  onClose: () => void;
}) {
  if (!result) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {result.students.length} matches for {result.companyName}
            </CardTitle>
            <CardDescription>Sorted by match score</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </CardHeader>
      <CardContent>
        {result.students.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No placement-ready students fit this company&apos;s open roles.
          </p>
        ) : (
          <ul className="space-y-2">
            {result.students.map((s) => (
              <li key={s.user_id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.display_name ?? s.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.primary_specialization ?? "—"}
                  </p>
                </div>
                <Badge variant="default">{s.match_score}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const CompaniesClient = { MatchButton, MatchResultCard };
export default CompaniesClient;
