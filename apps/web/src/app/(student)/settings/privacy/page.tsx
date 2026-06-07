"use client";

// T098 — Privacy controls: company-search opt-out + "Delete my account" flow.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function PrivacyControls() {
  const [searchVisible, setSearchVisible] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load on first render
  if (searchVisible === null) {
    createSupabaseBrowserClient()
      .from("users").select("company_search_visible").then(({ data }) => setSearchVisible(!!data?.[0]?.company_search_visible));
  }

  async function toggle(checked: boolean) {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.from("users").update({ company_search_visible: checked }).eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
    setSearchVisible(checked);
    setBusy(false);
  }

  async function requestDeletion() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.functions.invoke("privacy-request-deletion", { body: {} });
    setBusy(false);
    setConfirmDelete(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Recruiter discoverability</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Allow companies to find me in search results</p>
              <p className="text-xs text-muted-foreground">Off = you only appear in a company&apos;s direct invite.</p>
            </div>
            <Switch checked={!!searchVisible} onCheckedChange={toggle} disabled={busy} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> Delete my account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Within 24 hours we revoke your verifiable credentials. After 30 days, your account and any linked sources are permanently deleted.</p>
          {confirmDelete ? (
            <div className="flex gap-2">
              <Button variant="destructive" onClick={requestDeletion} disabled={busy}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, delete everything"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>Request account deletion</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Privacy controls</h1>
      <PrivacyControls />
    </div>
  );
}
