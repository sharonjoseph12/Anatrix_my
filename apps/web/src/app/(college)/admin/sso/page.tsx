// apps/web/src/app/(college)/admin/sso/page.tsx
// Server component. Renders the SSO configuration card for the admin's
// institution: status badge, WorkOS connection ID form (POSTs to
// /api/admin/sso/connection), and the public login URL students use.

import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ExternalLink, KeyRound } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SsoConnectionForm } from "./sso-connection-form";

function statusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "disabled") return "destructive";
  return "secondary";
}

export default async function CollegeAdminSsoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/sso");

  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id,institutions:public.institutions(id,name,slug)")
    .eq("user_id", user.id)
    .in("role", ["admin", "placement_officer"])
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const m = membership as unknown as {
    institution_id: string;
    institutions: { id: string; name: string; slug: string | null } | null;
  };
  const institutionId = m.institution_id;
  const inst = m.institutions;
  const slug = inst?.slug ?? null;

  const { data: sso } = await supabase
    .from("sso_connections")
    .select("id,workos_connection_id,idp_type,status,created_at")
    .eq("institution_id", institutionId)
    .maybeSingle();

  const ssoRow = (sso ?? null) as {
    id: string;
    workos_connection_id: string;
    idp_type: string | null;
    status: string;
    created_at: string;
  } | null;

  const loginUrl = slug ? `/api/sso/workos/login?institution_slug=${encodeURIComponent(slug)}` : null;
  const absoluteLoginUrl = slug
    ? null
    : null; // The relative URL is enough for the page; clients can prefix the host.

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-7 w-7" />
          Single Sign-On
        </h1>
        <p className="text-muted-foreground">
          Configure WorkOS SAML for {inst?.name ?? "your institution"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            WorkOS connection
          </CardTitle>
          <CardDescription>
            Paste the connection ID from your WorkOS dashboard. We&apos;ll mark
            the connection active immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={statusVariant(ssoRow?.status ?? null)}>
              {ssoRow?.status ?? "not configured"}
            </Badge>
            {ssoRow?.idp_type ? (
              <span className="text-muted-foreground">IdP: {ssoRow.idp_type}</span>
            ) : null}
            {ssoRow?.workos_connection_id ? (
              <span className="text-muted-foreground">
                ID: <code className="rounded bg-muted px-1 py-0.5">{ssoRow.workos_connection_id}</code>
              </span>
            ) : null}
          </div>
          <SsoConnectionForm
            institutionId={institutionId}
            initialWorkosConnectionId={ssoRow?.workos_connection_id ?? ""}
            initialIdpType={ssoRow?.idp_type ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student login URL</CardTitle>
          <CardDescription>
            Share this URL with students at your institution. They&apos;ll be
            redirected to your IdP and back into Antarix with a verified session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!slug ? (
            <p className="text-sm text-muted-foreground">
              Your institution is missing a <code>slug</code>. Run the 040
              migration backfill (or ask support) to enable SSO login.
            </p>
          ) : (
            <div className="space-y-2">
              <code className="block break-all rounded-md border bg-muted/40 p-3 text-xs">
                {loginUrl}
              </code>
              <p className="text-xs text-muted-foreground">
                Tip: place this link on your LMS or orientation page.
                {absoluteLoginUrl ? null : null}
              </p>
              <Link
                href={loginUrl ?? "#"}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                prefetch={false}
              >
                <ExternalLink className="h-3 w-3" /> Open in WorkOS (preview)
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
