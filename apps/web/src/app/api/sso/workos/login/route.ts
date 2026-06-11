// apps/web/src/app/api/sso/workos/login/route.ts
// GET /api/sso/workos/login?institution_slug=<slug>
// Public route. Resolves the institution + its active sso_connection,
// asks WorkOS for an authorization URL, and 302-redirects the user.
// D4 (research): WorkOS is the SAML 2.0 IdP broker.

import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getAuthorizationUrl } from "@/lib/sso/workos";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("institution_slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing institution_slug" }, { status: 400 });
  }

  const admin = createSupabaseServiceClient();

  const { data: institution } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!institution) {
    return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }
  const institutionId = (institution as { id: string }).id;

  const { data: sso } = await admin
    .from("sso_connections")
    .select("workos_connection_id,status")
    .eq("institution_id", institutionId)
    .eq("status", "active")
    .maybeSingle();
  if (!sso) {
    return NextResponse.json({ error: "SSO not configured for this institution" }, { status: 404 });
  }
  const workosConnectionId = (sso as { workos_connection_id: string }).workos_connection_id;

  try {
    const authUrl = await getAuthorizationUrl(slug, workosConnectionId);
    return NextResponse.redirect(authUrl, 302);
  } catch (err) {
    return NextResponse.json(
      { error: "SSO provider unavailable", detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
