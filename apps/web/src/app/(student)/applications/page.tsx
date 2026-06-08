"use client";

// T073 — Student's one-click-apply history.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Application = {
  id: string;
  company_id: string;
  status: string;
  credential_snapshot_id: string | null;
  applied_at: string;
  companies?: { name: string } | { name: string }[] | null;
};

const STATUSES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  submitted: { variant: "secondary", label: "Submitted" },
  viewed_by_company: { variant: "default", label: "Viewed" },
  interview_proposed: { variant: "default", label: "Interview proposed" },
  interview_accepted: { variant: "default", label: "Interview accepted" },
  rejected: { variant: "destructive", label: "Rejected" },
  withdrawn: { variant: "outline", label: "Withdrawn" },
};

export function ApplicationHistory() {
  const [items, setItems] = useState<Application[] | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("student_applications")
        .select("id,company_id,status,credential_snapshot_id,applied_at,companies(name)")
        .eq("student_user_id", user.id).order("applied_at", { ascending: false });
      setItems((data as Application[]) ?? []);
    })();
  }, []);

  if (!items) return <div className="h-32 animate-pulse rounded-md bg-muted" />;
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">No applications yet</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Search for companies in the recruiter-side and one-click-apply with your verified credential.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((a) => {
        const companyName = Array.isArray(a.companies) ? a.companies[0]?.name : (a.companies as { name?: string } | null)?.name;
        return (
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{companyName ?? a.company_id}</p>
                <p className="text-xs text-muted-foreground">Applied {new Date(a.applied_at).toLocaleDateString()}</p>
              </div>
              <Badge variant={STATUSES[a.status]?.variant ?? "outline"}>{STATUSES[a.status]?.label ?? a.status}</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My applications</h1>
      <ApplicationHistory />
    </div>
  );
}
