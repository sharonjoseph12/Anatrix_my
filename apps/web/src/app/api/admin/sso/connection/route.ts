// apps/web/src/app/api/admin/sso/connection/route.ts
// POST /api/admin/sso/connection
// Auth: institution admin / placement_officer at institution_id.
// Body: { institution_id, workos_connection_id, idp_type?, status? }
//
// Upserts a single sso_connections row for the institution. RLS does not
// allow institution members to write (writes are service-role-only), so
// we use the service-role client after verifying the caller is an admin.

import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import { ssoConnectionUpsertSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(ssoConnectionUpsertSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { institution_id, workos_connection_id, idp_type, status } = parsed.data;

  const { data: callerMembership } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institution_id)
    .in("role", ["admin", "placement_officer"])
    .maybeSingle();
  if (!callerMembership) {
    return NextResponse.json(
      { error: "Only institution admins or placement officers can configure SSO" },
      { status: 403 },
    );
  }

  const admin = createSupabaseServiceClient();
  const { data, error } = await admin
    .from("sso_connections")
    .upsert(
      {
        institution_id,
        workos_connection_id,
        idp_type: idp_type ?? null,
        status,
      },
      { onConflict: "institution_id" },
    )
    .select("id,workos_connection_id,idp_type,status,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ connection: data }, { status: 200 });
}
